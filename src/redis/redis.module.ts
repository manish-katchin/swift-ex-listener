import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisupdateController } from './redisupdate/redisupdate.controller';
import { DeviceModule } from 'src/device/device.module';
import { AuthModule } from 'src/auth/auth.module';


@Module({
  imports: [DeviceModule,AuthModule],
  providers: [RedisService],
  exports: [RedisService],
  controllers: [RedisupdateController],
})
export class RedisModule {}
