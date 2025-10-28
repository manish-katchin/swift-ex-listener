import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { DeviceService } from '../device/device.service';
import { Device } from '../device/schema/device.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateWalletDto } from './dto/updateWallet.dto';
import { ApiResponse } from '../common/interfaces/response';
import mongoose from 'mongoose';
import { SupportedWalletChain } from 'src/common/enum/chain.eum';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client: Redis;

  constructor(
    private readonly deviceService: DeviceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT), // default Redis port
      password: process.env.REDIS_PWD,
    });
    this.checkConnection();
  }

  onModuleDestroy() {
    this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  isReady(): boolean {
    return this.client && this.client.status === 'ready';
  }

  async checkConnection() {
    try {
      const pong = await this.client.ping();
      console.log('Redis PING response:', pong); // should log "PONG"
      return pong;
    } catch (err) {
      console.error('Redis connection failed:', err);
      return 'Not Ready';
    }
  }

  async setKey(key: string, value: string): Promise<string | number> {
    return this.client.sadd(key, value);
  }

  async setKeys(key: string, value: string[]): Promise<string | number> {
    return this.client.sadd(key, value);
  }

  async delKey(key: string, value: string): Promise<void> {
    await this.client.srem(key, value);
  }

  async isKeyExist(key: string, value: string) {
    const exists = await this.client.hget(key, value);
    return exists ? true : false;
  }

  async hSet(key: string, map: Record<string, string>): Promise<number> {
    return this.client.hset(key, map);
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hGetKey(key: string): Promise<string[]> {
    return this.client.hkeys(key);
  }
  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async handleUpdateAddressToRedis(
    body: UpdateWalletDto,
  ): Promise<ApiResponse> {
    const addressMapEth: Record<string, string> = {};
    const addressMapBnb: Record<string, string> = {};
    const addressMapStellar: Record<string, string> = {};
    let result: number[] = [];
    console.log('==== body ==', { body });

    try {
      const addresses: any = body.addresses;
      try {
        if (!addresses) {
          throw new Error('No Addresses Found');
        }
      } catch (error: any) {
        throw new HttpException(
          { success: false, error: error.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      let device: Device | null = await this.deviceService.findOne(
        body.deviceId as mongoose.Schema.Types.ObjectId,
      );
      if (!device) {
        throw new NotFoundException('Device not found');
      }
      console.log('==== device ==', { device });
      if (addresses[SupportedWalletChain.ETH])
        addressMapEth[SupportedWalletChain.ETH] = device.fcmToken;
      if (addresses[SupportedWalletChain.BNB])
        addressMapBnb[SupportedWalletChain.BNB] = device.fcmToken;
      if (SupportedWalletChain.XLM)
        addressMapStellar[SupportedWalletChain.XLM] = device.fcmToken;

      if (Object.keys(addressMapStellar).length > 0)
        result.push(
          await this.hSet(
            process.env.STELLAR_REDIS_KEY as string,
            addressMapStellar,
          ),
        );

      if (Object.keys(addressMapEth).length > 0) {
        result.push(
          await this.hSet(process.env.REDIS_KEY_ETH as string, addressMapEth),
        );
        try {
          this.eventEmitter.emit('wallet.updated', {
            webHookId: process.env.ALCHEMY_WEBHOOKID_ETH,
            addresses: [addresses[SupportedWalletChain.ETH]],
          });
        } catch (error) {
          this.logger.error('Error handling PUT event - from Alchemy', error);
          throw new HttpException(
            { success: false, error: error.message },
            HttpStatus.FAILED_DEPENDENCY,
          );
        }
      }

      if (Object.keys(addressMapBnb).length > 0) {
        result.push(
          await this.hSet(process.env.REDIS_KEY_BNB as string, addressMapBnb),
        );
        try {
          this.eventEmitter.emit('wallet.updated', {
            webHookId: process.env.ALCHEMY_WEBHOOKID_BNB,
            addresses: [addresses[SupportedWalletChain.BNB]],
          });
        } catch (error) {
          this.logger.error('Error handling PUT event - from Alchemy', error);
          throw new HttpException(
            { success: false, error: error.message },
            HttpStatus.FAILED_DEPENDENCY,
          );
        }
      }

      return { success: true, totalUpdated: result };
    } catch (error) {
      this.logger.error('Error handling PUT event', error);
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
