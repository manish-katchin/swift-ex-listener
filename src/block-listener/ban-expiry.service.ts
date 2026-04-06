import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import Redis from 'ioredis';
import { ALCHEMY_API_UPDATEHOOK } from '../common/constants/alchemy.constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BanExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BanExpiryService.name);
  private subscriber: Redis;
  private alchemyToken: string;
  private alchemyTokenMultichain: string;
  private baseUrl: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.alchemyToken = this.configService.get<string>('ALCHEMY_TOKEN') || '';
    this.alchemyTokenMultichain = this.configService.get<string>('ALCHEMY_TOKEN_MULTICHAIN') || '';
    this.baseUrl = this.configService.get<string>('ALCHEMY_BASE_URL') || '/';
  }

  async onModuleInit() {
    // Enable keyspace notifications for expired events
    await this.redisService.getClient().config('SET', 'notify-keyspace-events', 'Ex');

    // Create a separate Redis connection for subscribing
    this.subscriber = this.redisService.getClient().duplicate();

    await this.subscriber.subscribe('__keyevent@0__:expired');

    this.subscriber.on('message', async (_channel, key) => {
      if (!key.startsWith('notif:ban:')) return;

      // Key format: notif:ban:{chain}:{toAddress}
      const parts = key.split(':');
      if (parts.length < 4) return;

      const chain = parts[2];
      const toAddress = parts.slice(3).join(':'); // handle addresses with colons

      this.logger.log(`Ban expired for ${toAddress} on ${chain} — re-adding to webhook`);

      const { webhookId, token } = this.getWebhookConfig(chain);
      if (!webhookId) return;

      // Reset rate limit counters so address starts fresh
      await this.redisService.getClient().del(
        `notif:rate:1m:${chain}:${toAddress}`,
        `notif:rate:1h:${chain}:${toAddress}`,
      );

      await this.updateWebhook(webhookId, [toAddress], token);
    });

    this.logger.log('Ban expiry listener started');
  }

  onModuleDestroy() {
    this.subscriber?.disconnect();
  }

  private getWebhookConfig(network: string): { webhookId: string | undefined; token: string | undefined } {
    const multichainToken = this.alchemyTokenMultichain;
    const map: Record<string, { webhookId: string | undefined; token: string | undefined }> = {
      ETH:  { webhookId: process.env.ALCHEMY_WEBHOOKID_ETH,  token: this.alchemyToken },
      BNB:  { webhookId: process.env.ALCHEMY_WEBHOOKID_BNB,  token: this.alchemyToken },
      OPT:  { webhookId: process.env.ALCHEMY_WEBHOOKID_OP,   token: multichainToken },
      BASE: { webhookId: process.env.ALCHEMY_WEBHOOKID_BASE,  token: multichainToken },
      ARB:  { webhookId: process.env.ALCHEMY_WEBHOOKID_ARB,   token: multichainToken },
      AVAX: { webhookId: process.env.ALCHEMY_WEBHOOKID_AVAX,  token: multichainToken },
      MATIC:{ webhookId: process.env.ALCHEMY_WEBHOOKID_POL,   token: multichainToken },
    };
    return map[network] ?? { webhookId: undefined, token: undefined };
  }

  private async updateWebhook(webhookId: string, addressesToAdd: string[], token?: string): Promise<void> {
    const path = `${this.baseUrl}${ALCHEMY_API_UPDATEHOOK}`;
    const response = await fetch(path, {
      method: 'PATCH',
      headers: {
        'X-Alchemy-Token': token ?? this.alchemyToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook_id: webhookId,
        addresses_to_add: addressesToAdd,
        addresses_to_remove: [],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to re-add address to webhook: ${error}`);
    } else {
      this.logger.log(`Re-added ${addressesToAdd} to webhook ${webhookId}`);
    }
  }
}
