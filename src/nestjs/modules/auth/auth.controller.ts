import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      code: 0,
      message: '登录成功',
      data: result,
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return {
      code: 0,
      message: '注册成功',
      data: result,
    };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    return {
      code: 0,
      message: '刷新令牌成功',
      data: result,
    };
  }

  @Get('captcha')
  getCaptcha() {
    const result = this.authService.generateCaptcha();
    return {
      code: 0,
      message: '获取验证码成功',
      data: result,
    };
  }

  @Get('verify-captcha')
  verifyCaptcha(
    @Query('captchaId') captchaId: string,
    @Query('captchaText') captchaText: string,
  ) {
    const isValid = this.authService.verifyCaptcha(captchaId, captchaText);
    return {
      code: isValid ? 0 : -1,
      message: isValid ? '验证成功' : '验证失败',
      data: { valid: isValid },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return {
      code: 0,
      message: '获取用户信息成功',
      data: user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return {
      code: 0,
      message: '登出成功',
      data: null,
    };
  }
}
