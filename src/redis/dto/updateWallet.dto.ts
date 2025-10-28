import { IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import mongoose from 'mongoose';
import { SupportedWalletChain } from '../../common/enum/chain.eum';

export type AddressesDto = Record<SupportedWalletChain, string>;

export class UpdateWalletDto {
  @IsOptional()
  userId?: mongoose.Schema.Types.ObjectId;

  @IsNotEmpty()
  @IsObject()
  addresses: AddressesDto;

  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  deviceId: mongoose.Schema.Types.ObjectId;
}
