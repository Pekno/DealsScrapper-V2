import { Module } from '@nestjs/common';
import { PrismaModule } from '@dealscrapper/database';
import { NotificationProcessor } from './notification.processor.js';
import { WebSocketModule } from '../websocket/websocket.module.js';
import { ServicesModule } from '../services/services.module.js';
import { ChannelsModule } from '../channels/channels.module.js';

@Module({
  imports: [
    PrismaModule, // Import PrismaModule to make PrismaService/PrismaClient available
    WebSocketModule,
    ServicesModule,
    ChannelsModule,
  ],
  providers: [NotificationProcessor],
  exports: [NotificationProcessor],
})
export class ProcessorsModule {}
