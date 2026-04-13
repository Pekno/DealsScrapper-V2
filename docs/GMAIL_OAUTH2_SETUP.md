# Gmail OAuth2 Setup Guide

This guide walks you through setting up Gmail OAuth2 authentication for the DealScrapper email service.

## Prerequisites

- Google Account with Gmail access
- Google Cloud Console project
- Gmail API enabled

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your Project ID

### 1.2 Enable Gmail API
1. Navigate to **APIs & Services > Library**
2. Search for "Gmail API"
3. Click "Gmail API" and press **Enable**

### 1.3 Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (for personal use)
3. Fill required fields:
   - **App name**: `DealScrapper`
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**
5. Skip **Scopes** (click Save and Continue)
6. Add your email to **Test users**
7. Click **Save and Continue**

### 1.4 Create OAuth2 Credentials
1. Go to **APIs & Services > Credentials**
2. Click **+ Create Credentials > OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Set name: `DealScrapper Gmail OAuth2`
5. Add authorized redirect URI: `https://developers.google.com/oauthplayground`
6. Click **Create**
7. **Save the Client ID and Client Secret**

## Step 2: Generate Refresh Token

### 2.1 OAuth2 Playground Setup
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the **gear icon** (⚙️) in top right
3. Check **"Use your own OAuth credentials"**
4. Enter your **Client ID** and **Client Secret**

### 2.2 Authorize Gmail Scope
1. In left panel, find **Gmail API v1**
2. Select: `https://www.googleapis.com/auth/gmail.send`
3. Click **"Authorize APIs"**
4. Sign in with your Gmail account
5. Grant permissions to DealScrapper

### 2.3 Exchange Authorization Code
1. Click **"Exchange authorization code for tokens"**
2. **Copy the Refresh Token** (starts with `1//`)
3. **Save this token securely** - you won't see it again

## Step 3: Configure Environment Variables

Update your `.env` file with the OAuth2 credentials:

```bash
# Gmail OAuth2 Email Service
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=https://developers.google.com/oauthplayground
GMAIL_REFRESH_TOKEN=1//your-refresh-token
GMAIL_USER_EMAIL=your-gmail@gmail.com

# Email sender information
FROM_EMAIL=your-gmail@gmail.com
FROM_NAME=DealScrapper
```

## Step 4: Test Configuration

### 4.1 Test Email Service Startup
```bash
timeout 15s pnpm dev:notifier
```

**Expected Success Output:**
```
📧 Gmail OAuth2 email service initialized
📧 Configured sender: DealScrapper <your-gmail@gmail.com>
[LOG] Starting Nest application...
```

### 4.2 Test Email Sending (Optional)
Use the API endpoint to send a test verification email after the service is running.

## Security Best Practices

### Environment Variables
- **Never commit** OAuth credentials to version control
- Use **different credentials** for development/production
- **Rotate refresh tokens** periodically

### Gmail API Limits
- **250 quota units per user per second**
- **1 billion quota units per day**
- Each email send = ~10 quota units

### Production Considerations
- **Verify domain ownership** in Google Cloud Console
- **Publish OAuth consent screen** for production use
- **Monitor quota usage** in Google Cloud Console
- **Implement retry logic** for rate limiting

## Troubleshooting

### Common Issues

**"Invalid refresh token"**
- Regenerate refresh token using OAuth2 Playground
- Ensure token hasn't expired (they can expire if unused)

**"Insufficient permission"**
- Verify Gmail API is enabled
- Check OAuth scope includes `gmail.send`
- Ensure test user is added to OAuth consent screen

**"Invalid client"**
- Verify Client ID and Secret are correct
- Check redirect URI matches exactly

**"Daily limit exceeded"**
- Wait 24 hours or increase quota in Google Cloud Console
- Implement exponential backoff in retry logic

### Debug Mode
Set `LOG_LEVEL=debug` in `.env` for detailed logging.

## API Reference

### Gmail OAuth2 Configuration Interface
```typescript
interface GmailOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly refreshToken: string;
  readonly userEmail: string;
}
```

### Service Status Endpoint
The email service provides status information:
```typescript
{
  provider: 'Gmail OAuth2',
  configured: boolean,
  healthy: boolean,
  userEmail: string,
  lastCheck: Date
}
```

## Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Nodemailer OAuth2 Guide](https://nodemailer.com/smtp/oauth2/)