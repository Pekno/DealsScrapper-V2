import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationCleanupJob } from './notification-cleanup.job.js';
import { CleanupController } from './cleanup.controller.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CleanupController],
  providers: [NotificationCleanupJob],
  exports: [NotificationCleanupJob],
})
export class JobsModule {}
