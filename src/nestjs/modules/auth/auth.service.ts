import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../../models/user.model';
import { LoginDto, RegisterDto, CaptchaResponseDto, AuthResponseDto } from './dto/auth.dto';

const captchaStore = new Map<string, { text: string; expireAt: number }>();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { username, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['roles', 'roles.platforms'],
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('账户已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    await this.userRepository.update(user.id, {
      last_login_time: new Date(),
    });

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name || '',
        avatar: user.avatar || undefined,
        roles: user.getRoleCodes(),
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.userRepository.findOne({
      where: { username: registerDto.username },
    });

    if (existingUser) {
      throw new UnauthorizedException('用户名已存在');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    const user = this.userRepository.create({
      username: registerDto.username,
      password: hashedPassword,
      name: registerDto.name || '',
      email: registerDto.email || '',
      phone: registerDto.phone || '',
    });

    await this.userRepository.save(user);

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name || '',
        roles: [],
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      ) as { id: number };

      const user = await this.userRepository.findOne({
        where: { id: decoded.id },
        relations: ['roles', 'roles.platforms'],
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      const newToken = this.generateToken(user);
      return { token: newToken };
    } catch {
      throw new UnauthorizedException('无效的刷新令牌');
    }
  }

  async validateUser(userId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.platforms'],
    });
  }

  generateCaptcha(): CaptchaResponseDto {
    const svgCaptcha = require('svg-captcha');
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: '0o1il',
      noise: 2,
      color: true,
      background: '#f0f2f5',
    });

    const captchaId = uuidv4();
    captchaStore.set(captchaId, {
      text: captcha.text.toLowerCase(),
      expireAt: Date.now() + 5 * 60 * 1000,
    });

    setTimeout(() => {
      const captchaData = captchaStore.get(captchaId);
      if (captchaData && Date.now() > captchaData.expireAt) {
        captchaStore.delete(captchaId);
      }
    }, 5 * 60 * 1000);

    return {
      captchaId,
      captchaImg: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`,
    };
  }

  verifyCaptcha(captchaId: string, captchaText: string): boolean {
    const captchaData = captchaStore.get(captchaId);

    if (!captchaData || Date.now() > captchaData.expireAt) {
      return false;
    }

    const isValid = captchaData.text === captchaText.toLowerCase();

    if (isValid) {
      captchaStore.delete(captchaId);
    }

    return isValid;
  }

  private generateToken(user: User): string {
    const payload = {
      id: user.id,
      username: user.username,
      roles: user.getRoleCodes(),
      accessTags: [],
      accessPlatforms: user.getRolePlatforms(),
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '2h',
    });
  }

  private generateRefreshToken(user: User): string {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      { expiresIn: '7d' },
    );
  }
}
