import { Injectable, Logger } from '@nestjs/common';
import { Device } from './schema/device.schema';
import { DeviceRepository } from './device.repository';
import mongoose from 'mongoose';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly deviceRepo: DeviceRepository) {}

  findOne(_id: mongoose.Schema.Types.ObjectId): Promise<Device | null> {
    return this.deviceRepo.findOne({ _id });
  }

  findOneByUniqueId(uniqueId: string): Promise<Device | null> {
    return this.deviceRepo.findOne({ uniqueId });
  }
}
