import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { RedisService } from '../redis/redis.service';
import { FirebaseNotificationService } from '../notification/notification.service';
import { WalletService } from 'src/wallet/wallet.service';
import { DeviceService } from 'src/device/device.service';
import { Wallet } from '../wallet/schema/wallet.schema';
import { Device } from '../device/schema/device.schema';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Networks } from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server;
  private network: Networks;

  constructor(
    private readonly redisService: RedisService,
    private readonly notificationService: FirebaseNotificationService,
    private readonly walletService: WalletService,
    private readonly deviceService: DeviceService,
  ) {
    if (process.env.ENVIRONMENT == 'dev') {
      this.network = Networks.TESTNET;
    } else {
      this.network = Networks.PUBLIC;
    }
    this.server = new StellarSdk.Horizon.Server(
      process.env.RPC_STELLAR as string,
    );
  }

  async onModuleInit() {
    this.logger.log('Starting Ethereum log subscription...');
    await this.subscribeToPayment();
  }

  async getFcmToken(address: string): Promise<string | void> {
    try {
      const wallet: Wallet | null =
        await this.walletService.findByStellarAddress({
          stellarAddress: address,
        });

      if (!wallet) {
        this.logger.log(` === No wallet exist with address ${address} ===`);
        return;
      }

      const device: Device | null = await this.deviceService.findOne(
        wallet.deviceId,
      );

      if (!device) {
        this.logger.log(
          ` === No device exist with deviceId ${wallet.deviceId} ===`,
        );
        return;
      }

      return device.fcmToken;
    } catch (error) {
      this.logger.error('Error sending notification:', error.message);
    }
  }

  async subscribeToPayment() {
    // Subscribe to payments
    this.server
      .payments()
      .cursor('now')
      .stream({
        onmessage: async (payment) => {
          try {
            this.parseStellarTx(payment);
          } catch (err) {
            console.error('Error processing payment:', err.message);
          }
        },
        onerror: (err) => {
          console.error('Stellar stream error:', err.message || err);
        },
      });
  }

  async parseStellarTx(op: any) {
    if (
      op.type === 'payment' &&
      op.amount > 0.000009 &&
      (await this.redisService.isKeyExist(
        process.env.STELLAR_REDIS_KEY as string,
        op.to,
      ))
    ) {
      const fcmToken: string | void = await this.getFcmToken(op.to);
      const asset = op.asset_type === 'native' ? 'XLM' : `${op.asset_code}`;
      const title: string = `${asset.toUpperCase()} Transaction`;
      const body: string = `Received ${ethers.formatEther(op.amount)} ${asset.toUpperCase()} from ${op.from}`;
      await this.notificationService.sendNotification(fcmToken as string, {
        title,
        body,
      });
    }

    if (op.type === 'invoke_host_function') {
      // Smart contract execution with balance changes
      if (op.asset_balance_changes && op.asset_balance_changes.length > 0) {
        for (const change of op.asset_balance_changes) {
          if (
            change.to &&
            change.amount > 0.000009 &&
            (await this.redisService.isKeyExist(
              process.env.STELLAR_REDIS_KEY as string,
              op.to,
            ))
          ) {
            const fcmToken: string | void = await this.getFcmToken(op.to);
            const asset =
              op.asset_type === 'native' ? 'XLM' : `${op.asset_code}`;
            const title: string = `${asset.toUpperCase()} Transaction`;
            const body: string = `Received ${ethers.formatEther(change.amount)} ${asset.toUpperCase()} from ${op.from}`;
            await this.notificationService.sendNotification(
              fcmToken as string,
              {
                title,
                body,
              },
            );
            break;
          }
        }
      }
    }

    return null;
  }

  async addWalletsToRedis() {}
}
