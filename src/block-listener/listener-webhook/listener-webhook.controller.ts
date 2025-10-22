import { Controller, Post, Body, Get, Query, Logger } from '@nestjs/common';
import { BlockListenerService } from '../block-listener.service';

@Controller('listener-webhook')
export class ListenerWebhookController {
  private readonly logger = new Logger(ListenerWebhookController.name);

  constructor(private readonly blockListenerService: BlockListenerService) {}

  

  @Post('eventeth')
  async handleEventEth(@Body() body: any) {
    this.logger.log(`Received event`);
    await this.blockListenerService.handleWebhookEvent(body);
    return { success: true };
  }


  @Post('eventbnb')
  async handleEventBnb(@Body() body: any) {
    this.logger.log(`Received event`);
    await this.blockListenerService.handleWebhookEvent(body);
    return { success: true };
  }
 
}
