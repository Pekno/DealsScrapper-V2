import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '@dealscrapper/database';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AuditLoggerService } from './audit-logger.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    forwardRef(() => AuthModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, AuditLoggerService, UserRepository],
})
export class AdminModule {}
