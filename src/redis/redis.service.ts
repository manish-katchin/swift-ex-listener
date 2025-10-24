import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import Redis from 'ioredis';
import { DeviceService } from 'src/device/device.service';
import { Device } from 'src/device/schema/device.schema';
import { ApiResponse, RedisWalletBody } from './interfaces/redis-wallet.interface';


@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(RedisService.name);

  private client: Redis;

  constructor(
    private readonly deviceService: DeviceService,
  ) { }

  onModuleInit() {
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

  async checkConnection() {
    try {
      const pong = await this.client.ping();
      console.log('Redis PING response:', pong); // should log "PONG"
      return pong;
    } catch (err) {
      console.error('Redis connection failed:', err);
      throw err;
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

  async handleRedisEvent(body: RedisWalletBody): Promise<ApiResponse> {

    const addressMapEth: Record<string, string> = {};
    const addressMapBnb: Record<string, string> = {};
    const addressMapStellar: Record<string, string> = {};
    let result: number[] = []

    try {
      const wallets: any = body.wallets;
      try {
        if (!wallets) {
          throw new Error("No Wallets Found")
        }
      } catch (error: any) {
        throw new HttpException(
          { success: false, error: error.message },
          HttpStatus.BAD_REQUEST
        );
      }


      let record: Device = await this.deviceService.findOne(body.deviceId) as Device;

      if (wallets.ethAddress) addressMapEth[wallets.ethAddress] = record.fcmToken;
      if (wallets.bnbAddress) addressMapBnb[wallets.bnbAddress] = record.fcmToken;
      if (wallets.stellarAddress) addressMapStellar[wallets.stellarAddress] = record.fcmToken;


      if (Object.keys(addressMapEth).length > 0)
        result.push(await this.hSet(process.env.REDIS_KEY_ETH as string, addressMapEth));

      if (Object.keys(addressMapBnb).length > 0)
        result.push(await this.hSet(process.env.REDIS_KEY_BNB as string, addressMapBnb));

      if (Object.keys(addressMapStellar).length > 0)
        result.push(await this.hSet(process.env.STELLAR_REDIS_KEY as string, addressMapStellar));

      return { success: true, totalUpdated: result };
    } catch (error) {
      this.logger.error('Error handling PUT event', error);
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

}


