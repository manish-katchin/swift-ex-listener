import mongoose from "mongoose";

export interface Wallets {
  ethAddress?: string;
  bnbAddress?: string;
  stellarAddress?: string;
  multiChainAddress?: string;
}

export interface RedisWalletBody {
  _id: mongoose.Schema.Types.ObjectId;         
  deviceId: mongoose.Schema.Types.ObjectId;      
  wallets: Wallets;
  isPrimary?: boolean;
  streamId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface ApiResponse<T = any> {
  success?: boolean;
  status?: number;
  totalUpdated?: number[];
  error?: string;
}