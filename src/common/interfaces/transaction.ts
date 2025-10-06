import { Chain } from '../enum/chain.eum';

export interface Transaction {
  to: string;
  from: string;
  value: string;
  chain?: Chain;
}
