import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletRepository } from './wallet.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { Wallet, WalletSchema } from './schema/wallet.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Wallet.name, schema: WalletSchema }]),
    NotificationModule,
  ],
  providers: [WalletService, WalletRepository],
  exports: [WalletService],
  controllers: [],
})
export class WalletModule {}
