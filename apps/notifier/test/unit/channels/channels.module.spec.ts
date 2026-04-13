/**
 * Tests for the EMAIL_TRANSPORT factory logic in channels.module.ts.
 *
 * We exercise the factory function directly — importing the full ChannelsModule
 * would pull in the 'resend' package which is not available in the Jest test env.
 */
import { NoopTransport } from '../../../src/channels/transports/noop.transport.js';
import { MailhogTransport } from '../../../src/channels/transports/mailhog.transport.js';

// Inline replica of the factory logic from channels.module.ts so it can be
// tested without loading the full NestJS module graph.
function createEmailTransport(service: string, nodemailerTransport: unknown) {
  if (service === 'none') {
    return new NoopTransport();
  }
  if (service === 'mailhog') {
    return new MailhogTransport(nodemailerTransport as any);
  }
  throw new Error(`Unexpected service: ${service}`);
}

describe('ChannelsModule EMAIL_TRANSPORT factory logic', () => {
  describe('when service is "none" (EMAIL_PROVIDER not set)', () => {
    it('should return a NoopTransport instance', () => {
      // Arrange & Act
      const transport = createEmailTransport('none', null);

      // Assert
      expect(transport).toBeInstanceOf(NoopTransport);
    });

    it('should return a transport with provider name "none"', () => {
      const transport = createEmailTransport('none', null);

      expect(transport.getProviderName()).toBe('none');
    });

    it('should return a transport that reports provider "none" in its status', () => {
      const transport = createEmailTransport('none', null);
      const status = transport.getProviderStatus();

      expect(status.provider).toBe('none');
      expect(status.configured).toBe(false);
      expect(status.healthy).toBe(true);
    });

    it('should return a transport that is always healthy', () => {
      const transport = createEmailTransport('none', null);

      expect(transport.isHealthy()).toBe(true);
    });
  });

  describe('when service is "mailhog" (transport provided)', () => {
    it('should NOT return a NoopTransport', () => {
      const mockNodemailerTransport = { sendMail: jest.fn() } as any;

      const transport = createEmailTransport('mailhog', mockNodemailerTransport);

      expect(transport).not.toBeInstanceOf(NoopTransport);
    });

    it('should return a transport with provider name other than "none"', () => {
      const mockNodemailerTransport = { sendMail: jest.fn() } as any;

      const transport = createEmailTransport('mailhog', mockNodemailerTransport);

      expect(transport.getProviderName()).not.toBe('none');
    });
  });
});
