import { Test, TestingModule } from '@nestjs/testing';
import { BlockListenerService } from './block-listener.service';

describe('BlockListenerService', () => {
  let service: BlockListenerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockListenerService],
    }).compile();

    service = module.get<BlockListenerService>(BlockListenerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
