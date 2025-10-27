import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FirebaseNotificationService } from '../notification/notification.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Networks } from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server;
  private network: Networks;
  public i = 0;

  constructor(
    private readonly redisService: RedisService,
    private readonly notificationService: FirebaseNotificationService,
  ) {
    if (process.env.ENVIRONMENT == 'dev') {
      this.network = Networks.TESTNET;
    } else {
      this.network = Networks.PUBLIC;
    }
    this.server = new StellarSdk.Horizon.Server(
      process.env.RPC_STELLAR as string,
    );
  }

  async getCurrentLedger() {
    const ledger = await this.server.ledgers().order('desc').limit(1).call();
    return Number(ledger.records[0].sequence);
  }

  async sendNotification(
    address,
    tokenType,
    value,
    altText,
    from,
    txHash,
    type,
  ) {
    let network = 'STR';

    const data: Record<string, string> = {
      network,
      txHash: String(txHash),
      type: String(type),
    };

    const fcmToken: string | null = await this.redisService.hGet(
      process.env.STELLAR_REDIS_KEY as string,
      address,
    );
    if (fcmToken) {
      const title: string = `${altText} ${parseFloat(value)} ${tokenType} `;
      const body: string = `From ${from}`;
      await this.notificationService.sendNotification(fcmToken, {
        title,
        body,
        data,
      });
    }
  }

  async parseStellarEffect(effect) {
    if (
      effect.type === 'account_credited' &&
      (await this.redisService.isKeyExist(
        process.env.STELLAR_REDIS_KEY as string,
        effect.account,
      ))
    ) {
      const chain: string =
        effect.asset_type === 'native' ? 'XLM' : effect.asset_code;
      this.sendNotification(
        effect.account,
        chain,
        effect.amount,
        'Received: ',
        `${effect.account.slice(0, 4)}...${effect.account.slice(-4)}`,
        effect.transaction_hash,
        'trf',
      );
    }

    if (
      effect.type === 'trade' &&
      (await this.redisService.isKeyExist(
        process.env.STELLAR_REDIS_KEY as string,
        effect.account,
      ))
    ) {
      const soldAsset: string =
        effect.sold_asset_type === 'native' ? 'XLM' : effect.sold_asset_code;
      const boughtAsset: string =
        effect.bought_asset_type === 'native'
          ? 'XLM'
          : effect.bought_asset_code;
      let altText = `Bought: ${effect.bought_amount} ${boughtAsset}, Sold:`;
      this.sendNotification(
        effect.account,
        soldAsset,
        effect.sold_amount,
        altText,
        `Orderbook`,
        effect.transaction_hash,
        'swap',
      );
    }
  }

  // Fetch all effects for a single ledger, handling pagination
  async fetchLedgerEffects(ledgerNumber) {
    let page = await this.server
      .effects()
      .forLedger(ledgerNumber)
      .limit(200)
      .call();

    while (true) {
      for (const effect of page.records) {
        try {
          await this.parseStellarEffect(effect);
        } catch (err) {
          console.error('Error processing effect:', err.message);
        }
      }

      if (!page.records || page.records.length < 200 || !page.next) break;

      // Get next page
      page = await page.next();
    }
  }
  // Scan a range of ledgers safely with rate-limit handling
  async scanLedgerRange(startLedger, endLedger) {
    for (let ledger = startLedger; ledger <= endLedger; ledger++) {
      try {
        await this.fetchLedgerEffects(ledger);

        // Small delay to prevent Horizon 429 errors
        await new Promise((r) => setTimeout(r, 200)); // 200ms delay
      } catch (err) {
        if (err.response && err.response.status === 429) {
          console.warn('Rate limit hit, waiting 5s...');
          await new Promise((r) => setTimeout(r, 5000));
          ledger--; // retry same ledger
        } else {
          console.error('Ledger fetch failed:', err.message);
        }
      }
    }
  }

  async onModuleInit() {
    this.startLedgerLoop();
  }

  async startLedgerLoop() {
    this.logger.log('Starting stellar log subscription...');
    let lastLedger = await this.getCurrentLedger(); // initial ledger

    while (true) {
      try {
        let currentLedger = await this.getCurrentLedger(); // latest ledger from Horizon

        if (currentLedger > lastLedger) {
          this.scanLedgerRange(lastLedger + 1, currentLedger);
          lastLedger = currentLedger; // update last processed ledger
        } else {
          // No new ledger yet, wait a bit before checking again
          await new Promise((r) => setTimeout(r, 1000));
          currentLedger = await this.getCurrentLedger();
          if (currentLedger === lastLedger) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
        await new Promise((r) => setTimeout(r, 4000));
      } catch (err) {
        if (err.response && err.response.status === 429) {
          console.warn('Rate limit hit, waiting 5s...');
          await new Promise((r) => setTimeout(r, 5000));
        } else {
          console.error('Ledger fetch failed:', err.message);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
  }

  async addWalletsToRedis() {}
}
