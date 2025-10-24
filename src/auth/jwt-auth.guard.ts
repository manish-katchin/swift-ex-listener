import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) throw new UnauthorizedException('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    try {
      const payload = await this.authService.verifyToken(token);
        if (payload.email !== process.env.AUTH_EMAIL) {
        throw new UnauthorizedException('Email not authorized');
      }
      request.user = payload; 
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
