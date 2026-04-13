import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from './notification.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications', // External queue for notifier service
    }),
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
