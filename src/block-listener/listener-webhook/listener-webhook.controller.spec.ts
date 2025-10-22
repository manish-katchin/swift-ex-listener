import { Test, TestingModule } from '@nestjs/testing';
import { ListenerWebhookController } from './listener-webhook.controller';

describe('ListenerWebhookController', () => {
  let controller: ListenerWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListenerWebhookController],
    }).compile();

    controller = module.get<ListenerWebhookController>(ListenerWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
