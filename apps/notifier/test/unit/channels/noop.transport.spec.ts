import { NoopTransport } from '../../../src/channels/transports/noop.transport.js';

describe('NoopTransport', () => {
  let transport: NoopTransport;

  beforeEach(() => {
    transport = new NoopTransport();
  });

  describe('send()', () => {
    it('should return a result with messageId "noop" without throwing', async () => {
      // Arrange
      const payload = {
        to: 'user@example.com',
        from: 'noreply@dealscrapper.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      };

      // Act
      const result = await transport.send(payload);

      // Assert
      expect(result).toEqual({ messageId: 'noop' });
    });

    it('should silently discard the email (no side effects)', async () => {
      // Arrange
      const payload = {
        to: 'user@example.com',
        from: 'noreply@dealscrapper.com',
        subject: 'Deal Alert',
        html: '<p>Deal found!</p>',
        text: 'Deal found!',
      };

      // Act — call multiple times to confirm it is a no-op every time
      const result1 = await transport.send(payload);
      const result2 = await transport.send(payload);

      // Assert
      expect(result1).toEqual({ messageId: 'noop' });
      expect(result2).toEqual({ messageId: 'noop' });
    });
  });

  describe('getProviderName()', () => {
    it('should return "none"', () => {
      expect(transport.getProviderName()).toBe('none');
    });
  });

  describe('isHealthy()', () => {
    it('should always return true', () => {
      expect(transport.isHealthy()).toBe(true);
    });
  });

  describe('getProviderStatus()', () => {
    it('should return provider "none" with configured false and healthy true', () => {
      // Act
      const status = transport.getProviderStatus();

      // Assert
      expect(status.provider).toBe('none');
      expect(status.configured).toBe(false);
      expect(status.healthy).toBe(true);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });
  });
});
