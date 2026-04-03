import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { FirebaseNotificationService } from '../notification/notification.service';
import { WalletService } from '../wallet/wallet.service';
import {
  ALCHEMY_API_CREATEHOOK,
  ALCHEMY_NETWORK_ETH,
  WebhookConfig,
  ALCHEMY_GRAPHQL_QUERY_ETH,
  ALCHEMY_API_UPDATEHOOK,
} from '../common/constants/alchemy.constants';
import { OnEvent } from '@nestjs/event-emitter';
import { SupportedWalletChain } from 'src/common/enum/chain.eum';

@Injectable()
export class BlockListenerService {
  private readonly logger = new Logger(BlockListenerService.name);

  private baseUrl: string;

  private alchemyToken: string;

  private alchemyEventHookETH: string;

  private alchemyTokenMultichain: string;

  private isUpdateAllHooks: boolean;

  private isUpdateHookETH: boolean;

  private isUpdateRedis: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly notificationService: FirebaseNotificationService,
    private readonly walletService: WalletService,
  ) {
    this.baseUrl = this.configService.get<string>('ALCHEMY_BASE_URL') || '/';
    this.alchemyToken =
      this.configService.get<string>('ALCHEMY_TOKEN') || 'NAN';
    this.isUpdateAllHooks =
      this.configService.get<string>('UPDATE_ADDRESS_ALL_ALCHEMY') === 'true';
    this.isUpdateHookETH =
      this.configService.get<string>('UPDATE_ADDRESS_ETH_ALCHEMY') === 'true';
    this.isUpdateRedis =
      this.configService.get<string>('IS_REDIS_INIT') === 'true';
    this.alchemyEventHookETH =
      this.configService.get<string>('ALCHEMY_EVENT_ETH_HOOK') || 'NAN';
    this.alchemyTokenMultichain =
      this.configService.get<string>('ALCHEMY_TOKEN_MULTICHAIN') || 'NAN';
  }

  async onModuleInit() {
    this.logger.log('Starting Alchemy log subscription...');

    const multiAddresses = await this.addWalletAddressToRedis();

    await this.createWebhook({
      network: ALCHEMY_NETWORK_ETH,
      webhookName: ALCHEMY_NETWORK_ETH,
      updateHookFlag: this.isUpdateHookETH,
      webhookCallbackURL: this.alchemyEventHookETH,
      graphQlQuery: ALCHEMY_GRAPHQL_QUERY_ETH,
      apiURL: ALCHEMY_API_CREATEHOOK,
    }, multiAddresses);
  }

  private async createWebhook(config: WebhookConfig, addressKeys: string[]): Promise<void> {
    // ***** All hooks should be true to update any hook ******
    if (!this.isUpdateAllHooks || !config.updateHookFlag) return;

    const path: string = `${this.baseUrl}${config.apiURL}`;
    this.logger.log(`Creating New WebHook`);

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'X-Alchemy-Token': this.alchemyToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network: config.network,
        name: config.webhookName,
        webhook_type: 'ADDRESS_ACTIVITY',
        webhook_url: config.webhookCallbackURL,
        graphql_query: config.graphQlQuery,
        addresses: addressKeys,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new HttpException(`Alchemy error: ${error}`, response.status);
    }
    this.logger.log(
      ` === All Addresses Updated with Status ${response.status}`,
    );
  }

  private async updateWebhook(
    config: WebhookConfig,
    addressesToAdd: string[],
    addressesToRemove: string[] = [],
    token?: string,
  ): Promise<void> {
    const path: string = `${this.baseUrl}${config.apiURL}`;
    this.logger.log(`Updating Hook WebHook`);

    const response = await fetch(path, {
      method: 'PATCH',
      headers: {
        'X-Alchemy-Token': token ?? this.alchemyToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook_id: config.webHookId,
        addresses_to_add: addressesToAdd,
        addresses_to_remove: addressesToRemove,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(error);
    }
  }

  async handleWebhookEvent(body: any) {
    console.log("EVENT=============",body.event)
    const network = body.event.network.split('_')[0];

    const activities = body.event.activity || [];

    let activity: any = null;
    let fcmToken: any = "";
    for (const a of activities) {
      if (!a?.toAddress) continue;
      const normalizedValue =
  a.value ??
  (a.rawContract?.rawValue
    ? Number(a.rawContract.rawValue) /
      10 ** (a.rawContract.decimals || 18)
    : 0);

if (normalizedValue <= 0) continue;

      const wallet = await this.walletService.findByMultiAddressWithDevice(a.toAddress);
      fcmToken = (wallet as any)?.deviceId?.fcmToken;

      if (fcmToken) {
        activity = { ...a, normalizedValue };
        break;
      }
    }

    if (!activity || !fcmToken) return;

    console.log("============== NETWORK ===================\n", network)
    console.log("==============ALL activities ===================\n", activities)
    console.log("==============Selected activity ===================\n", activity)

    const fromAddress = activity.fromAddress;
    const toAddress = activity.toAddress;
    const isToken = activity?.category === 'token';
   const tokenType = isToken
  ? activity.asset ||
    `Token (${activity.rawContract?.address?.slice(0, 6) || ''}...)`
  : network;
    const value = activity.normalizedValue ?? activity.value ?? 0;
    const txHash = activity.hash;



    if (activity?.category === 'internal') return;


console.log(
      toAddress,"--",
      tokenType,"--",
      value,"--",
      'Received: ',"--",
      fromAddress,"--",
      network,"--",
      txHash,"--",
      fcmToken
    )

    this.sendNotification(
      toAddress,
      tokenType,
      value,
      'Received: ',
      fromAddress,
      network,
      txHash,
      fcmToken,
    );
  }

  async sendNotification(
    address,
    tokenType,
    value,
    altText,
    from,
    network,
    txHash,
    fcmToken,
  ) {

    if (fcmToken) {
      console.log("----firing---")
      const data: Record<string, string> = {
        network,
        txHash: String(txHash),
      };
      const title: string = `${altText} ${value}  ${tokenType} `;
      const body: string = `From ${from.slice(0, 6)}...${from.slice(-4)}`;

      if ([altText, value, tokenType].some(v => v == null)) return;
      console.log("---Firing---")
      await this.notificationService.sendNotification(fcmToken, {
        title,
        body,
        data,
      });
    }
  }

  @OnEvent('wallet.removed')
  async handleWalletRemove(payload) {
    const addresses = payload.addresses;

    await this.updateWebhook({ webHookId: process.env.ALCHEMY_WEBHOOKID_ETH, apiURL: ALCHEMY_API_UPDATEHOOK }, [], addresses);
    await this.updateWebhook({ webHookId: process.env.ALCHEMY_WEBHOOKID_BNB, apiURL: ALCHEMY_API_UPDATEHOOK }, [], addresses);

    const multichainWebhookIds = [
      process.env.ALCHEMY_WEBHOOKID_OP,
      process.env.ALCHEMY_WEBHOOKID_BASE,
      process.env.ALCHEMY_WEBHOOKID_AVAX,
      process.env.ALCHEMY_WEBHOOKID_POL,
      process.env.ALCHEMY_WEBHOOKID_ARB,
    ];
    for (const webhookId of multichainWebhookIds) {
      if (webhookId) await this.updateWebhook({ webHookId: webhookId, apiURL: ALCHEMY_API_UPDATEHOOK }, [], addresses, this.alchemyTokenMultichain);
    }
  }

  @OnEvent('wallet.updated')
  async handleWalletUpdateEth(payload) {
    const addresses = payload.addresses;

    // ETH + BNB
    await this.updateWebhook({ webHookId: process.env.ALCHEMY_WEBHOOKID_ETH, apiURL: ALCHEMY_API_UPDATEHOOK }, addresses);
    await this.updateWebhook({ webHookId: process.env.ALCHEMY_WEBHOOKID_BNB, apiURL: ALCHEMY_API_UPDATEHOOK }, addresses);

    // OP, BASE, AVAX, POL, ARB — shared multichain token
    const multichainWebhookIds = [
      process.env.ALCHEMY_WEBHOOKID_OP,
      process.env.ALCHEMY_WEBHOOKID_BASE,
      process.env.ALCHEMY_WEBHOOKID_AVAX,
      process.env.ALCHEMY_WEBHOOKID_POL,
      process.env.ALCHEMY_WEBHOOKID_ARB,
    ];
    for (const webhookId of multichainWebhookIds) {
      if (webhookId) await this.updateWebhook({ webHookId: webhookId, apiURL: ALCHEMY_API_UPDATEHOOK }, addresses, [], this.alchemyTokenMultichain);
    }
  }

  async addWalletAddressToRedis(): Promise<string[]> {
    if (!this.isUpdateRedis) return [];

    let limit = 200, offset = 0;
    const total = await this.walletService.totalXlmRecords();
    console.log('===total XLM wallets', total);

    while (true) {
      const records = await this.walletService.findAllXlmWithDevice(limit, offset);

      if (!records || records.length === 0) {
        this.logger.log('All XLM records processed');
        break;
      }

      const addressMapStellar: Record<string, string> = {};
      for (const record of records) {
        if (record?.addresses && record.deviceId) {
          const xlm = record.addresses.get(SupportedWalletChain.XLM);
          if (xlm) addressMapStellar[xlm] = record.deviceId.fcmToken;
        }
      }

      if (Object.keys(addressMapStellar).length > 0)
        await this.redisService.hSet(
          process.env.STELLAR_REDIS_KEY as string,
          addressMapStellar,
        );

      offset += limit;
    }
    return [];
  }
}
