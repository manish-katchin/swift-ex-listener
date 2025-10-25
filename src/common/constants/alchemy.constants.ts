
export const ALCHEMY_GRAPHQL_QUERY_ETH = `
{
  tokenTransfers(network: BNB_MAINNET) {
    fromAddress
    toAddress
    amount
    token { symbol decimals }
    transaction { hash }
    block { network }
  }
  transfers(network: BNB_MAINNET) {
    fromAddress
    toAddress
    amount
    transaction { hash }
    block { network }
  }
}
`;
export const ALCHEMY_GRAPHQL_QUERY_BNB = `
{
  tokenTransfers(network: BNB_MAINNET) {
    fromAddress
    toAddress
    amount
    token { symbol decimals }
    transaction { hash }
    block { network }
  }
  transfers(network: BNB_MAINNET) {
    fromAddress
    toAddress
    amount
    transaction { hash }
    block { network }
  }
}
`;

export const ALCHEMY_API_CREATEHOOK = '/create-webhook';

export const ALCHEMY_API_UPDATEHOOK = '/update-webhook-addresses';

export const ALCHEMY_NETWORK_ETH = 'ETH_MAINNET';

export const ALCHEMY_NETWORK_BNB = 'BNB_MAINNET';

export interface WebhookConfig {
  redisKey?: string;            
  network?: string;             
  webhookName?: string;         
  updateHookFlag?: boolean;   
  webhookCallbackURL?: string;
  apiURL?:string;
  graphQlQuery?:string;
  webHookId?:string;
}


