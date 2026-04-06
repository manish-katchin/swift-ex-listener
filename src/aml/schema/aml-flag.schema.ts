import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

export enum AmlFlagType {
  SUSPICIOUS = 'suspicious',
  MALICIOUS = 'malicious',
}

@Schema({ timestamps: true })
export class AmlFlag {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  fromAddress: string;

  @Prop({ required: true })
  toAddress: string;

  @Prop({ required: true })
  chain: string;

  @Prop({ required: true, enum: AmlFlagType })
  flag: AmlFlagType;

  @Prop({ type: [String], default: [] })
  targetWallets: string[];

  @Prop({ default: false })
  reviewed: boolean;
}

export const AmlFlagSchema = SchemaFactory.createForClass(AmlFlag);
