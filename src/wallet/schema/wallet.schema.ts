import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

@Schema({ timestamps: true })
export class Wallet {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceSchema',
    required: false,
  })
  deviceId: mongoose.Schema.Types.ObjectId;

  @Prop()
  multiChainAddress: string;

  @Prop()
  stellarAddress: string;

  @Prop({ type: Boolean, default: false })
  isPrimary: boolean;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
