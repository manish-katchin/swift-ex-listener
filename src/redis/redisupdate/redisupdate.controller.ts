import { Controller, Put, Body, Logger, UseGuards, Req } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisWalletBody } from '../interfaces/redis-wallet.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';



@Controller('redisupdate')
export class RedisupdateController {

    private readonly logger = new Logger(RedisupdateController.name);

    constructor(private readonly RedisService: RedisService) { }

    @UseGuards(JwtAuthGuard)
    @Put('updateredis')
    async handleEventRedis(@Body() body: RedisWalletBody, @Req() req: any) {
        this.logger.log(`Received PUT event for Redis update`);
        return await this.RedisService.handleRedisEvent(body);
    }


}
