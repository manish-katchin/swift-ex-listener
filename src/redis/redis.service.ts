import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: 6379, // default Redis port
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
    const exists = await this.client.sismember(key, value);
    return exists ? true : false;
  }
}
