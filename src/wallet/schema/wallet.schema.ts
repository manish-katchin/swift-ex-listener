import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Device } from 'src/device/schema/device.schema';


export type WalletPopulated = Wallet & {
  deviceId?: Device;
};

@Schema({ timestamps: true })
export class Wallet {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: false,
  })
  deviceId: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: Map,
    of: String, // each chain name → address
    default: {},
  })
  wallets: Map<string, string>;

  @Prop({ type: Boolean, default: false })
  isPrimary: boolean;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
