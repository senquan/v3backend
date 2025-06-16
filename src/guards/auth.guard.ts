import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    return this.validateRequest(request);
  }

  private validateRequest(request: Request): boolean {
    // 从请求头中获取 token
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    // 验证 token 格式
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('认证令牌格式错误');
    }

    const token = parts[1];
    try {
      // 验证 token
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, secret);
      
      // 将解码后的用户信息附加到请求对象上，以便后续使用
      (request as any).user = decoded;
      
      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('认证令牌已过期');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('无效的认证令牌');
      } else {
        throw new UnauthorizedException('认证失败');
      }
    }
  }
}