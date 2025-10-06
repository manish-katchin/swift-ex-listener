import { Module } from '@nestjs/common';
import { FirebaseNotificationService } from './notification.service';

@Module({
  providers: [FirebaseNotificationService],
  exports: [FirebaseNotificationService],
})
export class NotificationModule {}
