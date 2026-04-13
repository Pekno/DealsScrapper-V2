import { Module } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { notifierLogConfig } from '../config/logging.config.js';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service.js';
import { TemplateModule } from '../templates/template.module.js';
import { TemplateService } from '../templates/template.service.js';
import { GmailTransport, ResendTransport, MailhogTransport, NoopTransport } from './transports/index.js';
import type { EmailTransport } from './transports/index.js';

import { NODEMAILER_TRANSPORT, EMAIL_TRANSPORT } from './tokens.js';

const logger = createServiceLogger(notifierLogConfig);

@Module({
  imports: [TemplateModule],
  providers: [
    {
      provide: NODEMAILER_TRANSPORT,
      useFactory: (sharedConfig: SharedConfigService) => {
        const emailConfig = sharedConfig.getEmailConfig();
        if (emailConfig.service === 'resend' || emailConfig.service === 'none') {
          return null;
        }
        logger.log(`Initializing ${emailConfig.service} nodemailer transport.`);
        return nodemailer.createTransport(emailConfig.transport);
      },
      inject: [SharedConfigService],
    },
    {
      provide: EMAIL_TRANSPORT,
      useFactory: (
        sharedConfig: SharedConfigService,
        nodemailerTransport: nodemailer.Transporter | null,
      ): EmailTransport => {
        const emailConfig = sharedConfig.getEmailConfig();

        if (emailConfig.service === 'none') {
          logger.log('Email provider not configured — email sending is disabled.');
          return new NoopTransport();
        }

        logger.log(`Creating ${emailConfig.service} email transport.`);

        switch (emailConfig.service) {
          case 'resend':
            return new ResendTransport(sharedConfig);
          case 'gmail':
            return new GmailTransport(nodemailerTransport!, sharedConfig);
          case 'mailhog':
          default:
            return new MailhogTransport(nodemailerTransport!);
        }
      },
      inject: [SharedConfigService, NODEMAILER_TRANSPORT],
    },
    EmailService,
    TemplateService,
  ],
  exports: [EmailService, TemplateService],
})
export class ChannelsModule {}
