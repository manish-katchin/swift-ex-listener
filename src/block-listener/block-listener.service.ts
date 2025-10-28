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
  ALCHEMY_NETWORK_BNB,
  ALCHEMY_GRAPHQL_QUERY_BNB,
  ALCHEMY_API_UPDATEHOOK,
} from '../common/constants/alchemy.constants';
import { WalletWithDevice } from '../wallet/wallet.types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SupportedWalletChain } from 'src/common/enum/chain.eum';

@Injectable()
export class BlockListenerService {
  private readonly logger = new Logger(BlockListenerService.name);

  private baseUrl: string;

  private alchemyToken: string;

  private alchemyEventHookETH: string;

  private alchemyEventHookBNB: string;

  private isUpdateAllHooks: boolean;

  private isUpdateHookETH: boolean;

  private isUpdateHookBNB: boolean;

  private isUpdateRedis: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly notificationService: FirebaseNotificationService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.baseUrl = this.configService.get<string>('ALCHEMY_BASE_URL') || '/';
    this.alchemyToken =
      this.configService.get<string>('ALCHEMY_TOKEN') || 'NAN';
    this.isUpdateAllHooks =
      this.configService.get<string>('UPDATE_ADDRESS_ALL_ALCHEMY') === 'true';
    this.isUpdateHookETH =
      this.configService.get<string>('UPDATE_ADDRESS_ETH_ALCHEMY') === 'true';
    this.isUpdateHookBNB =
      this.configService.get<string>('UPDATE_ADDRESS_BNB_ALCHEMY') === 'true';
    this.isUpdateRedis =
      this.configService.get<string>('IS_REDIS_INIT') === 'true';
    this.alchemyEventHookETH =
      this.configService.get<string>('ALCHEMY_EVENT_ETH_HOOK') || 'NAN';
    this.alchemyEventHookBNB =
      this.configService.get<string>('ALCHEMY_EVENT_BNB_HOOK') || 'NAN';
  }

  async onModuleInit() {
    this.logger.log('Starting Alchemy log subscription...');

    await this.addWalletAddressToRedis();

    await this.createWebhook({
      redisKey: process.env.REDIS_KEY_ETH as string,
      network: ALCHEMY_NETWORK_ETH,
      webhookName: ALCHEMY_NETWORK_ETH,
      updateHookFlag: this.isUpdateHookETH,
      webhookCallbackURL: this.alchemyEventHookETH,
      graphQlQuery: ALCHEMY_GRAPHQL_QUERY_ETH,
      apiURL: ALCHEMY_API_CREATEHOOK,
    });

    await this.createWebhook({
      redisKey: process.env.REDIS_KEY_BNB as string,
      network: ALCHEMY_NETWORK_BNB,
      webhookName: ALCHEMY_NETWORK_BNB,
      updateHookFlag: this.isUpdateHookBNB,
      webhookCallbackURL: this.alchemyEventHookBNB,
      graphQlQuery: ALCHEMY_GRAPHQL_QUERY_BNB,
      apiURL: ALCHEMY_API_CREATEHOOK,
    });
  }

  private async createWebhook(config: WebhookConfig): Promise<void> {
    // ***** All hooks should be true to update any hook ******
    if (!this.isUpdateAllHooks || !config.updateHookFlag) return;

    let addressKeys: string[] = await this.redisService.hGetKey(
      config.redisKey as string,
    );

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
    addressKeys: string[],
  ): Promise<void> {
    const path: string = `${this.baseUrl}${config.apiURL}`;
    this.logger.log(`Updating Hook WebHook`);

    const response = await fetch(path, {
      method: 'PATCH',
      headers: {
        'X-Alchemy-Token': this.alchemyToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook_id: config.webHookId,
        addresses_to_add: addressKeys,
        addresses_to_remove: [],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(error);
    }
  }

  handleWebhookEvent(body: any) {
    const network = body.event.network.split('_')[0];
    const activity = body.event.activity[0];
    const fromAddress = activity.fromAddress;
    const toAddress = activity.toAddress;
    const isToken = activity?.category === 'token';
    const tokenType = isToken ? activity.asset : network;
    const value = activity.value;
    const txHash = activity.hash;
    const redisKey =
      network === 'ETH' ? process.env.REDIS_KEY_ETH : process.env.REDIS_KEY_BNB;

    this.sendNotification(
      toAddress,
      tokenType,
      value,
      'Received: ',
      fromAddress,
      network,
      txHash,
      redisKey,
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
    redisKey,
  ) {
    const fcmToken: string | null = await this.redisService.hGet(
      redisKey as string,
      address,
    );
    const data: Record<string, string> = {
      network,
      txHash: String(txHash),
    };

    if (fcmToken) {
      const title: string = `${altText} ${value}  ${tokenType} `;
      const body: string = `From ${from.slice(0, 6)}...${from.slice(-4)}`;
      await this.notificationService.sendNotification(fcmToken, {
        title,
        body,
        data,
      });
    }
  }

  @OnEvent('wallet.updated')
  async handleWalletUpdateEth(payload) {
    await this.updateWebhook(
      {
        webHookId: payload.webHookId,
        apiURL: ALCHEMY_API_UPDATEHOOK,
      },
      payload.addresses,
    );
  }

  async addWalletAddressToRedis() {
    if (!this.isUpdateRedis) return;

    let limit = 200,
      offset = 0;
    const total = await this.walletService.totalRecords();
    console.log('===total ', total);
    while (true) {
      const records = await this.walletService.findAllByWithDevice(
        limit,
        offset,
      );

      if (records && records.length == 0) {
        this.logger.log('All records processed');
        break;
      }

      const addressMapEth: Record<string, string> = {};
      const addressMapBnb: Record<string, string> = {};
      const addressMapStellar: Record<string, string> = {};
      for (const record of records as WalletWithDevice[]) {
        if (record && record.addresses && record.deviceId) {
          const wallet: WalletWithDevice = record;

          if (record.addresses.get(SupportedWalletChain.ETH))
            addressMapEth[
              record.addresses.get(SupportedWalletChain.ETH) as string
            ] = record.deviceId.fcmToken;
          if (record.addresses.get(SupportedWalletChain.BNB))
            addressMapBnb[
              record.addresses.get(SupportedWalletChain.BNB) as string
            ] = record.deviceId.fcmToken;
          if (record.addresses.get(SupportedWalletChain.XLM))
            addressMapStellar[
              record.addresses.get(SupportedWalletChain.XLM) as string
            ] = record.deviceId.fcmToken;
        }
      }
      if (Object.keys(addressMapEth).length > 0)
        await this.redisService.hSet(
          process.env.REDIS_KEY_ETH as string,
          addressMapEth,
        );

      if (Object.keys(addressMapBnb).length > 0)
        await this.redisService.hSet(
          process.env.REDIS_KEY_BNB as string,
          addressMapBnb,
        );

      if (Object.keys(addressMapStellar).length > 0)
        await this.redisService.hSet(
          process.env.STELLAR_REDIS_KEY as string,
          addressMapStellar,
        );

      offset += limit;
    }
  }
}
