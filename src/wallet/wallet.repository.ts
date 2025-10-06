import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet } from './schema/wallet.schema';

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
}
