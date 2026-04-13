import { Module, forwardRef } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { ChannelsModule } from '../channels/channels.module.js';
import { WebSocketModule } from '../websocket/websocket.module.js';
import { UserStatusService } from './user-status.service.js';
import { NotificationPreferencesService } from './notification-preferences.service.js';
import { ActivityTrackingService } from './activity-tracking.service.js';
import { RateLimitingService } from './rate-limiting.service.js';
import { DeliveryTrackingService } from './delivery-tracking.service.js';
import { ChannelHealthService } from './channel-health.service.js';
import { Redis } from 'ioredis';

@Module({
  imports: [ChannelsModule, forwardRef(() => WebSocketModule)],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (sharedConfig: SharedConfigService) => {
        return new Redis(sharedConfig.getRedisConfig());
      },
      inject: [SharedConfigService],
    },
    UserStatusService,
    NotificationPreferencesService,
    ActivityTrackingService,
    RateLimitingService,
    DeliveryTrackingService,
    ChannelHealthService,
  ],
  exports: [
    'REDIS_CLIENT',
    UserStatusService,
    NotificationPreferencesService,
    ActivityTrackingService,
    RateLimitingService,
    DeliveryTrackingService,
    ChannelHealthService,
  ],
})
export class ServicesModule {}
