import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway.js';
import { UserStatusService } from '../services/user-status.service.js';
import { ServicesModule } from '../services/services.module.js';
import { ChannelsModule } from '../channels/channels.module.js';

@Module({
  imports: [JwtModule, forwardRef(() => ServicesModule), ChannelsModule],
  providers: [NotificationGateway, UserStatusService],
  exports: [NotificationGateway, UserStatusService],
})
export class WebSocketModule {}
