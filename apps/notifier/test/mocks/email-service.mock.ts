/**
 * EmailService Mock for E2E Tests
 *
 * Prevents real email sending while maintaining test coverage
 * of the notification pipeline business logic.
 */

export interface MockEmailData {
  to: string;
  subject: string;
  template?: string;
  data?: any;
  timestamp: Date;
}

export const createEmailServiceMock = () => {
  const sentEmails: MockEmailData[] = [];

  return {
    sendEmail: jest.fn().mockImplementation(async (options: any) => {
      // Simulate email validation
      if (!options.to || !options.to.includes('@')) {
        console.log(`[MOCK EMAIL] Invalid email address: ${options.to}`);
        return false;
      }

      // Record the email for test assertions
      sentEmails.push({
        to: options.to,
        subject: options.subject || 'Test Email',
        template: options.template,
        data: options.data,
        timestamp: new Date(),
      });

      console.log(
        `[MOCK EMAIL] ✅ Email sent to ${options.to}: ${options.subject}`
      );
      return true;
    }),

    sendDealMatchEmail: jest
      .fn()
      .mockImplementation(
        async (
          to: string,
          dealData: any,
          filterName?: string,
          userId?: string
        ) => {
          sentEmails.push({
            to,
            subject: `🎯 New Deal Alert: ${dealData.title || 'Deal'}`,
            template: 'deal-match',
            data: { dealData, filterName, userId },
            timestamp: new Date(),
          });

          console.log(`[MOCK EMAIL] ✅ Deal match email sent to ${to}`);
          return true;
        }
      ),

    sendDigestEmail: jest
      .fn()
      .mockImplementation(
        async (to: string, digestData: any, userId?: string) => {
          sentEmails.push({
            to,
            subject: '📧 Your Daily Deal Digest',
            template: 'daily-digest',
            data: { digestData, userId },
            timestamp: new Date(),
          });

          console.log(`[MOCK EMAIL] ✅ Digest email sent to ${to}`);
          return true;
        }
      ),

    sendSystemNotification: jest
      .fn()
      .mockImplementation(
        async (to: string, subject: string, message: string) => {
          sentEmails.push({
            to,
            subject,
            template: 'system-notification',
            data: { message },
            timestamp: new Date(),
          });

          console.log(
            `[MOCK EMAIL] ✅ System notification sent to ${to}: ${subject}`
          );
          return true;
        }
      ),

    sendEmailVerification: jest
      .fn()
      .mockImplementation(async (to: string, verificationData: any) => {
        sentEmails.push({
          to,
          subject: 'Please verify your email address',
          template: 'email-verification',
          data: verificationData,
          timestamp: new Date(),
        });

        console.log(`[MOCK EMAIL] ✅ Verification email sent to ${to}`);
        return true;
      }),

    getProviderStatus: jest.fn().mockReturnValue({
      provider: 'Test Mock Service',
      configured: true,
      healthy: true,
      userEmail: 'noreply@test.example.com',
      lastCheck: new Date(),
    }),

    // Test utility methods for assertions
    getSentEmails: () => [...sentEmails],
    clearSentEmails: () => sentEmails.splice(0, sentEmails.length),
    getLastSentEmail: () => sentEmails[sentEmails.length - 1],
    getEmailsSentTo: (email: string) =>
      sentEmails.filter((e) => e.to === email),
    getEmailsWithSubject: (subject: string) =>
      sentEmails.filter((e) => e.subject.includes(subject)),
  };
};
