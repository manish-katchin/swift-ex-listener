import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';
import { DeviceModule } from 'src/device/device.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [DeviceModule, AuthModule],
  providers: [RedisService],
  exports: [RedisService],
  controllers: [RedisController],
})
export class RedisModule {}
