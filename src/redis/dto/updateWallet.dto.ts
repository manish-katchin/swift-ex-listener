import {
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import mongoose from 'mongoose';

export class WalletDto {
  @IsNotEmpty()
  @ValidateIf((o) => !o.multiChainAddress)
  ethAddress: string;

  @IsNotEmpty()
  @ValidateIf((o) => !o.otherProperty)
  bnbAddress: string;

  @IsOptional()
  stellarAddress?: string;

  @IsNotEmpty()
  @ValidateIf((o) => !o.ethAddress)
  multiChainAddress: string;
}

export class UpdateWalletDto {
  @IsOptional()
  userId?: mongoose.Schema.Types.ObjectId;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => WalletDto) // <-- ✅ required for proper validation
  wallets: WalletDto;

  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  deviceId: mongoose.Schema.Types.ObjectId;
}
