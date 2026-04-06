import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const NOTIF_1MIN_LIMIT = 5;
const NOTIF_1HR_LIMIT = 20;
const BAN_SHORT_SECS = 20 * 60;   // 20 minutes
const BAN_LONG_SECS = 24 * 60 * 60; // 24 hours

const AML_SENDER_WALLET_LIMIT_10MIN = 10;  // > 10 different wallets in 10 mins → suspicious
const AML_SENDER_WALLET_LIMIT_1HR = 20;    // > 20 different wallets in 1 hour → malicious

export enum BanType {
  SHORT = 'short', // 20 min
  LONG = 'long',   // 24 hr
}

export enum AmlFlag {
  SUSPICIOUS = 'suspicious',
  MALICIOUS = 'malicious',
}

export interface RateLimitResult {
  banned: boolean;
  banType?: BanType;
}

export interface AmlResult {
  flagged: boolean;
  flag?: AmlFlag;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redisService: RedisService) {}

  private get client() {
    return this.redisService.getClient();
  }

  // ─── Layer 1: per toAddress notification rate ────────────────────────────

  async isToAddressBanned(toAddress: string, chain: string): Promise<boolean> {
    const key = `notif:ban:${chain}:${toAddress}`;
    const val = await this.client.get(key);
    return !!val;
  }

  async trackAndCheckToAddress(toAddress: string, chain: string): Promise<RateLimitResult> {
    const key1min = `notif:rate:1m:${chain}:${toAddress}`;
    const key1hr = `notif:rate:1h:${chain}:${toAddress}`;
    const banKey = `notif:ban:${chain}:${toAddress}`;

    const [count1min, count1hr] = await Promise.all([
      this.client.incr(key1min),
      this.client.incr(key1hr),
    ]);

    if (count1min === 1) await this.client.expire(key1min, 60);
    if (count1hr === 1) await this.client.expire(key1hr, 3600);

    if (count1hr > NOTIF_1HR_LIMIT) {
      await this.client.set(banKey, BanType.LONG, 'EX', BAN_LONG_SECS);
      this.logger.warn(`24hr ban applied to ${toAddress} on ${chain}`);
      return { banned: true, banType: BanType.LONG };
    }

    if (count1min > NOTIF_1MIN_LIMIT) {
      await this.client.set(banKey, BanType.SHORT, 'EX', BAN_SHORT_SECS);
      this.logger.warn(`20min ban applied to ${toAddress} on ${chain}`);
      return { banned: true, banType: BanType.SHORT };
    }

    return { banned: false };
  }

  async liftBan(toAddress: string, chain: string): Promise<void> {
    await this.client.del(`notif:ban:${chain}:${toAddress}`);
  }

  // ─── Layer 2: per fromAddress AML monitoring ─────────────────────────────

  async trackAndCheckFromAddress(fromAddress: string, toAddress: string, chain: string): Promise<AmlResult> {
    const key10min = `aml:sender:10m:${chain}:${fromAddress}`;
    const key1hr = `aml:sender:1h:${chain}:${fromAddress}`;

    // Track unique toAddresses hit by this sender
    const [unique10min, unique1hr] = await Promise.all([
      this.client.sadd(key10min, toAddress),
      this.client.sadd(key1hr, toAddress),
    ]);

    // Set TTL on first add
    if (unique10min === 1) await this.client.expire(key10min, 600);  // 10 mins
    if (unique1hr === 1) await this.client.expire(key1hr, 3600);     // 1 hour

    const [count10min, count1hr] = await Promise.all([
      this.client.scard(key10min),
      this.client.scard(key1hr),
    ]);

    if (count1hr > AML_SENDER_WALLET_LIMIT_1HR) {
      this.logger.warn(`AML MALICIOUS: ${fromAddress} hit ${count1hr} wallets in 1hr on ${chain}`);
      return { flagged: true, flag: AmlFlag.MALICIOUS };
    }

    if (count10min > AML_SENDER_WALLET_LIMIT_10MIN) {
      this.logger.warn(`AML SUSPICIOUS: ${fromAddress} hit ${count10min} wallets in 10min on ${chain}`);
      return { flagged: true, flag: AmlFlag.SUSPICIOUS };
    }

    return { flagged: false };
  }
}
