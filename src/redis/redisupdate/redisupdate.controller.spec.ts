import { Test, TestingModule } from '@nestjs/testing';
import { RedisupdateController } from './redisupdate.controller';

describe('RedisupdateController', () => {
  let controller: RedisupdateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedisupdateController],
    }).compile();

    controller = module.get<RedisupdateController>(RedisupdateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
