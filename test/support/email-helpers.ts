/**
 * Email Helper Functions for Cypress Tests
 *
 * Provides MailHog integration for email testing
 */

import axios from 'axios';

const MAILHOG_URL = process.env.CYPRESS_MAILHOG_URL || 'http://localhost:8025';

/**
 * Get all messages from MailHog
 * @param recipient Optional email to filter by recipient
 * @returns Array of email messages
 */
export async function getEmailMessages(recipient?: string): Promise<any[]> {
  try {
    const response = await axios.get(`${MAILHOG_URL}/api/v2/messages`);
    let messages = response.data.items || [];

    if (recipient) {
      messages = messages.filter((msg: any) =>
        msg.To.some((to: any) => `${to.Mailbox}@${to.Domain}` === recipient)
      );
    }

    console.log(
      `📧 Found ${messages.length} email messages${recipient ? ` for ${recipient}` : ''}`
    );
    return messages;
  } catch (error) {
    console.error('❌ Failed to get email messages:', error);
    throw error;
  }
}

/**
 * Clear all messages from MailHog
 */
export async function clearEmailMessages(): Promise<void> {
  try {
    await axios.delete(`${MAILHOG_URL}/api/v1/messages`);
    console.log('✅ Email messages cleared');
  } catch (error) {
    console.error('❌ Failed to clear email messages:', error);
    throw error;
  }
}

/**
 * Wait for an email to arrive for a specific recipient
 * @param recipient Email address to wait for
 * @param subject Optional subject to match
 * @param timeout Timeout in milliseconds
 * @returns The matching email message
 */
export async function waitForEmail(
  recipient: string,
  subject?: string,
  timeout: number = 30000
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const messages = await getEmailMessages(recipient);

    for (const message of messages) {
      if (subject) {
        const messageSubject = message.Content.Headers.Subject?.[0] || '';
        if (messageSubject.includes(subject)) {
          console.log(
            `✅ Found email for ${recipient} with subject "${subject}"`
          );
          return message;
        }
      } else {
        console.log(`✅ Found email for ${recipient}`);
        return message;
      }
    }

    // Wait 2 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Email not received within ${timeout}ms for ${recipient}${subject ? ` with subject "${subject}"` : ''}`
  );
}
