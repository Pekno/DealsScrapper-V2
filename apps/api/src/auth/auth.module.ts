import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { EmailVerificationService } from './services/email-verification.service.js';
import { PasswordResetService } from './services/password-reset.service.js';
import { UsersModule } from '../users/users.module.js';
import { PrismaModule } from '@dealscrapper/database';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
    BullModule.registerQueue({
      name: 'notifications',
    }),
    forwardRef(() => UsersModule),
  ],
  providers: [
    AuthService,
    EmailVerificationService,
    PasswordResetService,
    JwtStrategy,
    LocalStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, EmailVerificationService, PasswordResetService, JwtModule],
})
export class AuthModule {}
