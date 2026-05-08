import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  id: number;
  username: string;
  roles: string[];
  accessTags: number[];
  accessPlatforms: number[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload.id);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('账户已被禁用');
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      roles: user.getRoleCodes(),
      accessTags: [],
      accessPlatforms: user.getRolePlatforms(),
    };
  }
}
