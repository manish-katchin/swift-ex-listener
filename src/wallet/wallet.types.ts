import { Wallet } from './schema/wallet.schema';
import { Device } from 'src/device/schema/device.schema';

export type WalletWithDevice = Omit<Wallet, 'deviceId'> & {
  deviceId?: Device; 
};