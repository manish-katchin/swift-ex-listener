import { Module } from '@nestjs/common';
import { BlockListenerService } from './block-listener.service';
import { RedisModule } from '../redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';
import { DeviceModule } from '../device/device.module';
import { ConfigModule } from '@nestjs/config';
import { ListenerWebhookController } from './listener-webhook/listener-webhook.controller';

@Module({
  imports: [RedisModule, NotificationModule, WalletModule, DeviceModule],
  providers: [BlockListenerService],
  controllers: [ListenerWebhookController],
})
export class BlockListenerModule {}
