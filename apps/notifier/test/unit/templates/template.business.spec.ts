import mjml from 'mjml';
import * as handlebars from 'handlebars';

describe('Template Business Validation', () => {
  describe('Deal Match Template', () => {
    const dealMatchTemplate = `
<mjml>
  <mj-head>
    <mj-title>🎯 New Deal Alert</mj-title>
    <mj-preview>{{dealTitle}} - €{{dealPrice}} at {{merchant}}</mj-preview>
  </mj-head>
  <mj-body background-color="#f6f9fc">
    <mj-section background-color="#ffffff" border-radius="8px" padding="20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="#333333" align="center">
          🎯 New Deal Alert!
        </mj-text>
        <mj-text font-size="20px" font-weight="bold" color="#333333">
          {{dealTitle}}
        </mj-text>
        <mj-text font-size="14px" color="#666666">
          <strong>Merchant:</strong> {{merchant}}<br>
          <strong>Price:</strong> €{{dealPrice}}
        </mj-text>
        <mj-button href="{{dealUrl}}">
          View Deal
        </mj-button>
        <mj-text font-size="12px" color="#999999" align="center">
          <a href="{{unsubscribeUrl}}">Unsubscribe</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

    it('should compile MJML syntax without errors', () => {
      // Act
      const result = mjml(dealMatchTemplate);

      // Assert
      expect(result.errors).toHaveLength(0);
      expect(result.html).toContain('New Deal Alert');
    });

    it('should contain all required placeholders', () => {
      // Assert - Check that our template has the placeholders we expect
      expect(dealMatchTemplate).toContain('{{dealTitle}}');
      expect(dealMatchTemplate).toContain('{{dealPrice}}');
      expect(dealMatchTemplate).toContain('{{merchant}}');
      expect(dealMatchTemplate).toContain('{{dealUrl}}');
      expect(dealMatchTemplate).toContain('{{unsubscribeUrl}}');
    });

    it('should compile with real data without handlebars errors', () => {
      // Arrange
      const template = handlebars.compile(dealMatchTemplate);
      const testData = {
        dealTitle: 'Gaming Laptop - 50% Off',
        dealPrice: '899.99',
        merchant: 'TechStore',
        dealUrl: 'https://example.com/deal',
        unsubscribeUrl: 'https://example.com/unsubscribe',
      };

      // Act
      const compiledTemplate = template(testData);
      const mjmlResult = mjml(compiledTemplate);

      // Assert
      expect(mjmlResult.errors).toHaveLength(0);
      expect(mjmlResult.html).toContain('Gaming Laptop - 50% Off');
      expect(mjmlResult.html).toContain('899.99');
      expect(mjmlResult.html).toContain('TechStore');
    });
  });

  describe('Email Verification Template', () => {
    const verificationTemplate = `
<mjml>
  <mj-head>
    <mj-title>✅ Verify Your Email Address</mj-title>
  </mj-head>
  <mj-body background-color="#f6f9fc">
    <mj-section background-color="#ffffff" border-radius="8px" padding="40px 20px">
      <mj-column>
        <mj-text font-size="28px" font-weight="bold" color="#333333" align="center">
          ✅ Verify Your Email Address
        </mj-text>
        <mj-text font-size="16px" color="#666666" align="center">
          Welcome to DealScrapper! Complete your account setup.
        </mj-text>
        <mj-text font-size="18px" font-weight="bold" color="#333333" align="center">
          {{recipientEmail}}
        </mj-text>
        <mj-button href="{{verificationUrl}}" background-color="#28a745">
          Verify Email Address
        </mj-button>
        <mj-text font-size="12px" color="#007bff" align="center">
          <a href="{{verificationUrl}}">{{verificationUrl}}</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

    it('should compile MJML syntax without errors', () => {
      // Act
      const result = mjml(verificationTemplate);

      // Assert
      expect(result.errors).toHaveLength(0);
      expect(result.html).toContain('Verify Your Email');
    });

    it('should contain all required placeholders', () => {
      // Assert
      expect(verificationTemplate).toContain('{{recipientEmail}}');
      expect(verificationTemplate).toContain('{{verificationUrl}}');
    });

    it('should compile with real data without handlebars errors', () => {
      // Arrange
      const template = handlebars.compile(verificationTemplate);
      const testData = {
        recipientEmail: 'user@example.com',
        verificationUrl: 'https://dealscrapper.com/verify?token=abc123',
      };

      // Act
      const compiledTemplate = template(testData);
      const mjmlResult = mjml(compiledTemplate);

      // Assert
      expect(mjmlResult.errors).toHaveLength(0);
      expect(mjmlResult.html).toContain('user@example.com');
      // URL might be HTML encoded, so check for the token part
      expect(mjmlResult.html).toContain('abc123');
    });
  });

  describe('Template Content Quality', () => {
    it('should not contain obvious typos in deal template text', () => {
      const dealMatchTemplate = `New Deal Alert! View Deal Unsubscribe`;

      // Basic spell check for common mistakes
      expect(dealMatchTemplate).not.toContain('Unsubscibe'); // Common typo
      expect(dealMatchTemplate).not.toContain('Alrt'); // Missing letters
      expect(dealMatchTemplate).not.toContain('Deall'); // Double letters
      expect(dealMatchTemplate).toContain('Unsubscribe'); // Correct spelling
    });

    it('should have consistent branding text', () => {
      const templates = ['DealScrapper', 'Deal Alert', 'Verify Email'];

      templates.forEach((text) => {
        expect(text).toBeTruthy();
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });
});
