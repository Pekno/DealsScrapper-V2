import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { UsersService } from '../../users/users.service.js';
import { JwtPayload, AuthenticatedUser, UserRole } from '@dealscrapper/shared-types';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(
    private sharedConfig: SharedConfigService,
    private usersService: UsersService
  ) {
    const jwtConfig = sharedConfig.getJwtConfig();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.secret,
    });
    this.logger.debug('JWT Strategy initializing with SharedConfigService');
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is locked');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      emailVerified: user.emailVerified,
      role: (user.role as UserRole) ?? UserRole.USER,
    };
  }
}
