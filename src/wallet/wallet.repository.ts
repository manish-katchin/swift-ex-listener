import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet } from './schema/wallet.schema';
import { WalletWithDevice } from './wallet.types';

@Injectable()
export class WalletRepository {
  private readonly logger = new Logger(WalletRepository.name);
  constructor(
    @InjectModel(Wallet.name)
    private walletModel: Model<Wallet>,
  ) {}

  async findOne(cond: Record<string, any>): Promise<Wallet | null> {
    return await this.walletModel.findOne(cond);
  }

  async find(cond: Record<string, any>): Promise<Wallet[] | null> {
    return await this.walletModel.find(cond);
  }

  async findWallets(limit: number, offset: number): Promise<Wallet[] | null> {
    return this.walletModel.find({}).skip(offset).limit(limit);
  }

  async totalCount(): Promise<number> {
    return this.walletModel.countDocuments();
  }

  async findAllByWithDevice(
    limit: number,
    offset: number,
  ): Promise<WalletWithDevice[] | null> {
    return this.walletModel.find({}).skip(offset).limit(limit).populate({
      path: 'deviceId',
      select: 'fcmToken',
    }) as unknown as WalletWithDevice[];
  }

  async migrateWalletFields(): Promise<void> {
    try {
      const result = await this.walletModel.updateMany(
        { wallets: { $exists: false } },
        [
          {
            $set: {
              addresses: {
                bnb: '$multiChainAddress',
                eth: '$multiChainAddress',
                multi: '$multiChainAddress',
                xlm: '$stellarAddress',
              },
            },
          },
          {
            $unset: ['multiChainAddress', 'stellarAddress'],
          },
        ],
      );

      this.logger.log(
        `Migration complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`,
      );
    } catch (error) {
      this.logger.error('Error running wallet migration', error);
      throw error;
    }
  }
}
