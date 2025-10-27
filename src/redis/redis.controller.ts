import { Controller, Put, Body, Logger, UseGuards, Req } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateWalletDto } from './dto/updateWallet.dto';

@Controller('redis')
export class RedisController {
  private readonly logger = new Logger(RedisController.name);

  constructor(private readonly redisService: RedisService) {}

  @UseGuards(JwtAuthGuard)
  @Put('')
  async handleUpdateAddressToRedis(
    @Body() body: UpdateWalletDto,
    @Req() _: any,
  ) {
    this.logger.log(`Received PUT event for Redis update`);
    return await this.redisService.handleUpdateAddressToRedis(body);
  }
}
