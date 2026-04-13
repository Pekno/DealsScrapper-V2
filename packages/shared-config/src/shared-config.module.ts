/**
 * @fileoverview SharedConfigModule - Centralized environment variable validation
 * Provides strict validation of REQUIRED environment variables at startup
 */

import * as fs from 'fs';
import * as path from 'path';
import { Module, DynamicModule, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedConfigService } from './shared-config.service.js';
import type { SharedConfigOptions } from './interfaces/config.interface.js';

/**
 * Global shared configuration module that validates environment variables at startup
 * Uses hybrid approach: immediate validation + injectable service
 */
@Global()
@Module({})
export class SharedConfigModule {
  /**
   * Create a SharedConfigModule with environment validation
   * @param config - Configuration options with service name and env variables
   * @returns Dynamic module with validated configuration
   */
  static forRoot(options: SharedConfigOptions): DynamicModule {
    // 🚨 VALIDATE IMMEDIATELY (Early validation of process.env)
    SharedConfigModule.validateEnvironment(
      options.serviceName,
      options.envConfig
    );

    // ✅ Setup injectable service (after validation passes)
    return {
      module: SharedConfigModule,
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true, // Environment variables should already be loaded
          cache: true, // Cache environment variables
        }),
      ],
      providers: [
        {
          provide: 'SHARED_CONFIG_OPTIONS',
          useValue: options,
        },
        SharedConfigService,
      ],
      exports: [SharedConfigService],
      global: true,
    };
  }

  /**
   * Resolves APP_VERSION from the service's own package.json if not already set.
   * Reads synchronously from process.cwd()/package.json so it works at module
   * creation time before any async context is available.
   */
  private static resolveAppVersion(): void {
    const current = process.env.APP_VERSION;
    if (current && current !== '1.0.0') {
      return;
    }

    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw) as { version?: string };
      if (pkg.version) {
        process.env.APP_VERSION = pkg.version;
      }
    } catch {
      // package.json unreadable — leave existing value (or '1.0.0' fallback)
    }
  }

  /**
   * Validates environment variables immediately during module creation.
   * Prevents service startup if REQUIRED variables are missing.
   * Also resolves APP_VERSION from the service's package.json before validation.
   * @param serviceName - Name of the service for error messages
   * @param envConfig - Environment variable requirements
   */
  private static validateEnvironment(
    serviceName: string,
    envConfig: Record<string, 'REQUIRED' | 'OPTIONAL'>
  ): void {
    SharedConfigModule.resolveAppVersion();

    const missing: string[] = [];

    // Silent mode for tests - suppress validation logs but keep error reporting
    const silent =
      process.env.NODE_ENV === 'test' ||
      process.env.SILENT_CONFIG_VALIDATION === 'true';

    if (!silent) {
      console.log(`🔍 Validating ${serviceName} service configuration...`);
    }

    for (const [key, requirement] of Object.entries(envConfig)) {
      const value = process.env[key];
      const isPresent =
        value !== undefined && value !== null && value.trim() !== '';

      if (requirement === 'REQUIRED') {
        if (isPresent) {
          if (!silent) {
            console.log(`  ✔ ${key} is PRESENT`);
          }
        } else {
          missing.push(key);
          console.error(`  ❌ ${key} is REQUIRED`);
        }
      } else {
        if (isPresent) {
          if (!silent) {
            console.log(`  ✔ ${key} is PRESENT (optional)`);
          }
        } else {
          if (!silent) {
            console.warn(`  💡 ${key} is OPTIONAL (not provided)`);
          }
        }
      }
    }

    if (missing.length > 0) {
      const errorMessage = `❌ ${serviceName} service: Missing REQUIRED environment variables: ${missing.join(', ')}`;
      console.error(errorMessage);
      console.error(
        `🚨 Service startup halted. Please check your environment variables.`
      );
      process.exit(1); // Fail immediately, prevent startup
    }

    if (!silent) {
      console.log(
        `✅ ${serviceName} service: Configuration validation completed successfully`
      );
    }
  }
}
