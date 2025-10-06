import { IsEthereumAddress, IsNotEmpty } from 'class-validator';

export class WalletAddressDto {
  @IsNotEmpty()
  @IsEthereumAddress()
  walletAddress: string;
}
