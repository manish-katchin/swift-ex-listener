import { Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { RedisModule } from '../redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [RedisModule, NotificationModule, WalletModule, DeviceModule],
  providers: [StellarService],
})
export class StellarModule {}
