import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SharedConfigService } from '@dealscrapper/shared-config';
import {
  NotificationsController,
  TrackingController,
} from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ServicesModule } from '../services/services.module.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: async (sharedConfig: SharedConfigService) => {
        const jwtConfig = sharedConfig.getJwtConfig();
        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.expiresIn,
          },
        };
      },
      inject: [SharedConfigService],
    }),
    ServicesModule, // Import ServicesModule to make DeliveryTrackingService available
  ],
  controllers: [NotificationsController, TrackingController],
  providers: [NotificationsService, NotificationRepository, JwtAuthGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
