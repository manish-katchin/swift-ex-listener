import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { FirebaseNotificationService } from '../notification/notification.service';
import { WalletService } from '../wallet/wallet.service';
import { DeviceService } from '../device/device.service';
import { Wallet } from '../wallet/schema/wallet.schema';
import { Device } from '../device/schema/device.schema';
import { Chain } from '../common/enum/chain.eum';

@Injectable()
export class BlockListenerService {
  private readonly logger = new Logger(BlockListenerService.name);
  private readonly ethProvider: ethers.WebSocketProvider;
  private readonly bscProvider: ethers.WebSocketProvider;
  private tokenAddresses: string[];
  private transferTopic: string;
  private addressToTokenMapping: Map<string, string> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly notificationService: FirebaseNotificationService,
    private readonly walletService: WalletService,
    private readonly deviceService: DeviceService,
  ) {
    const ethWsUrl = this.configService.get<string>('ETH_WS_URL');
    const bscWsUrl = this.configService.get<string>('BSC_WS_URL');
    console.log(ethWsUrl, bscWsUrl);
    this.ethProvider = new ethers.WebSocketProvider(ethWsUrl as string);
    this.bscProvider = new ethers.WebSocketProvider(bscWsUrl as string);

    this.transferTopic = this.configService.get<string>(
      'TRANSFER_EVENT_TOPIC',
    ) as string;

    this.mapContractAddressToSymbol();
    this.tokenAddresses = Array.from(this.addressToTokenMapping.keys());
  }

  async onModuleInit() {
    this.logger.log('Starting Ethereum log subscription...');
    await this.addWalletAddressToRedis();
    // await this.subscribeToTransferEvents();
    //await this.subscribeToNewBlocks();
  }

  private async subscribeToTransferEvents(): Promise<void> {
    this.ethProvider.on(
      { address: this.tokenAddresses, topics: [this.transferTopic] },
      (log) => this.handleLog(log),
    );

    this.bscProvider.on(
      { address: this.tokenAddresses, topics: [this.transferTopic] },
      (log) => this.handleLog(log),
    );

    this.logger.log(
      `Listening for Transfer events on ${this.tokenAddresses.length} token(s)`,
    );
  }

  private async handleLog(log: ethers.Log): Promise<void> {
    try {
      const parsed = this.decodeTransferLog(log);
      this.logger.debug(
        `Transfer detected — from: ${parsed.from}, to: ${parsed.to}, value: ${parsed.value}`,
      );
      if (
        await this.redisService.isKeyExist(
          process.env.REDIS_KEY as string,
          parsed.to,
        )
      ) {
        const fcmToken: string | void = await this.getFcmToken(parsed.to);
        if (fcmToken) {
          const tokenType: string | undefined = this.addressToTokenMapping.get(
            parsed.address,
          );
          const title: string = `${tokenType} Transaction`;
          const body: string = `Received ${ethers.formatEther(parsed.value)} ${tokenType} from ${parsed.from}`;

          await this.notificationService.sendNotification(fcmToken, {
            title,
            body,
          });
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`Error decoding log: ${err.message}`);
      } else {
        this.logger.error(`Unknown error: ${String(err)}`);
      }
    }
  }

  private decodeTransferLog(log: ethers.Log) {
    const iface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);
    const decoded = iface.parseLog(log);

    return {
      from: decoded?.args.from,
      to: decoded?.args.to,
      value: ethers.formatUnits(decoded?.args.value, 18),
      address: log.address,
    };
  }

  private async subscribeToNewBlocks(): Promise<void> {
    console.log('==== ethProvider ===', this.ethProvider);
    this.ethProvider.on('block', async (blockNumber: number) => {
      try {
        this.logger.log('==== new block received ===', blockNumber);
        const block = await this.ethProvider.getBlock(blockNumber, true);
        if (!block?.transactions) return;
        this.logger.log('==== managing block ===', blockNumber);

        await this.manageBlock(block, Chain.Eth);
      } catch (err: unknown) {
        if (err instanceof Error) {
          this.logger.error(`Block handler error: ${err.message}`);
        } else {
          this.logger.error(`Unknown block handler error: ${String(err)}`);
        }
      }
    });

    this.bscProvider.on('block', async (blockNumber: number) => {
      try {
        const block = await this.bscProvider.getBlock(blockNumber, true);
        if (!block?.transactions) return;
        await this.manageBlock(block, Chain.Bsc);
      } catch (err: unknown) {
        if (err instanceof Error) {
          this.logger.error(`Block handler error: ${err.message}`);
        } else {
          this.logger.error(`Unknown block handler error: ${String(err)}`);
        }
      }
    });

    this.logger.log(`Subscribed to new block headers.`);
  }

  async manageBlock(block: ethers.Block, chain: Chain) {
    await Promise.all(
      block.transactions.map(async (tx: any) => {
        if (
          tx.value &&
          tx.to &&
          (await this.redisService.isKeyExist(
            process.env.ETH_KEY as string,
            tx.to,
          ))
        ) {
          const deviceToken = await this.getFcmToken(tx.to);
          if (!deviceToken) {
            this.logger.log('=== No device token found===');
            return;
          }
          const tokenType: string = chain === Chain.Bsc ? 'BNB' : 'ETH';
          const title: string = `${tokenType} Transaction`;
          const body: string = `Received ${ethers.formatEther(tx.value)} ETH from ${tx.to}`;
          await this.notificationService.sendNotification(deviceToken, {
            title,
            body,
          });
        }
      }),
    );
  }

  async getFcmToken(address: string): Promise<string | void> {
    try {
      const wallet: Wallet | null =
        await this.walletService.findByMultiChainAddressWithoutDevice({
          walletAddress: address,
        });

      if (!wallet) {
        this.logger.log(` === No wallet exist with address ${address} ===`);
        return;
      }

      const device: Device | null = await this.deviceService.findOne(
        wallet.deviceId,
      );

      if (!device) {
        this.logger.log(
          ` === No device exist with deviceId ${wallet.deviceId} ===`,
        );
        return;
      }

      return device.fcmToken;
    } catch (error) {
      this.logger.error('Error sending notification:', error.message);
    }
  }

  mapContractAddressToSymbol() {
    const contractAddressesStr: string | undefined =
      this.configService.get<string>('CONTRACT_ADDRESSES_TO_WATCH');

    const contractSymbolStr: string | undefined =
      this.configService.get<string>('TOKEN_TO_WATCH');

    if (contractSymbolStr && contractAddressesStr) {
      const contractSymbols: string[] = contractSymbolStr.split(',');
      const contractAddresses: string[] = contractAddressesStr.split(',');
      console.log('===== contractSymbols', contractSymbols);
      console.log('===== map===', this.addressToTokenMapping);

      for (let i = 0; i < contractSymbols.length; i++) {
        console.log('===== ma p===', this.addressToTokenMapping);
        this.addressToTokenMapping.set(
          contractAddresses[i],
          contractSymbols[i],
        );
      }
    }
  }

  async addWalletAddressToRedis() {
    let limit = 20,
      offset = 0;
    const total = await this.walletService.totalRecords();
    console.log('===total ', total);
    while (true) {
      const records = await this.walletService.getWallets(limit, offset);
      console.log(records);
      if (records && records.length == 0) {
        this.logger.log('All records processed');
        break;
      }
      // Process your records here
      const multiChainAddresses: string[] = [];
      const stellarAddresses: string[] = [];
      for (const record of records as Wallet[]) {
        // do something with record
        multiChainAddresses.push(record?.multiChainAddress);
        stellarAddresses.push(record?.stellarAddress);
      }
      this.redisService.setKeys(
        process.env.REDIS_KEY as string,
        multiChainAddresses,
      );

      this.redisService.setKeys(
        process.env.STELLAR_REDIS_KEY as string,
        stellarAddresses,
      );
      offset += limit;
    }
  }
}
