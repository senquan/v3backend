import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsString()
  email?: string;

  @IsString()
  phone?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class CaptchaResponseDto {
  captchaId!: string;
  captchaImg!: string;
}

export class AuthResponseDto {
  token!: string;
  refreshToken!: string;
  user!: {
    id: number;
    username: string;
    name: string;
    avatar?: string;
    roles: string[];
  };
}
