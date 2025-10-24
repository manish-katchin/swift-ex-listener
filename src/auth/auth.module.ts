import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
    imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'NA',
     // signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService,JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}


