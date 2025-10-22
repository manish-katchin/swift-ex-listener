import { Injectable, Logger } from '@nestjs/common';
import { WalletRepository } from './wallet.repository';
import { Wallet } from './schema/wallet.schema';
import mongoose from 'mongoose';
import { StellarAddressDto } from './dto/stellar-address.dto';
import { WalletAddressDto } from './dto/wallet-address.dto';
import { WalletWithDevice } from './wallet.types';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly walletRepo: WalletRepository) { }

  async findByStellarAddress(
    stellarAddressDto: StellarAddressDto,
  ): Promise<Wallet | null> {
    const { stellarAddress } = stellarAddressDto;
    return this.walletRepo.findOne({ stellarAddress });
  }

  async findByMultiChainAddress(
    walletAddressDto: WalletAddressDto,
    deviceId: mongoose.Schema.Types.ObjectId,
  ): Promise<Wallet[] | null> {
    const { walletAddress } = walletAddressDto;
    return this.walletRepo.find({ multiChainAddress: walletAddress, deviceId });
  }

  async findByMultiChainAddressWithoutDevice(
    walletAddressDto: WalletAddressDto,
  ): Promise<Wallet | null> {
    const { walletAddress } = walletAddressDto;
    return this.walletRepo.findOne({ multiChainAddress: walletAddress });
  }

  async getWallets(limit: number, offset: number) {
    return this.walletRepo.findWallets(limit, offset);
  }


  async totalRecords() {
    return this.walletRepo.totalCount();
  }

  async findAllByWithDevice(
    limit: number, offset: number
  ): Promise<WalletWithDevice[] | null> {

    return this.walletRepo.findAllByWithDevice(limit, offset);
  }

}
