import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StellarModule } from './stellar/stellar.module';
import { RedisModule } from './redis/redis.module';
import { NotificationModule } from './notification/notification.module';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockListenerModule } from './block-listener/block-listener.module';
import { DeviceModule } from './device/device.module';
import { WalletModule } from './wallet/wallet.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_CONN_STRING as any, {
      dbName: process.env.DB_NAME,
    }),
    AuthModule,
    StellarModule,
    RedisModule,
    NotificationModule,
    BlockListenerModule,
    DeviceModule,
    WalletModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
