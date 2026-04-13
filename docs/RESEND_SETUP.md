# Resend Email Setup

[Resend](https://resend.com) is the simplest way to configure email notifications in DealsScrapper. It requires only an API key — no OAuth2 dance, no SMTP credentials.

## When to use Resend vs Gmail

| | Resend | Gmail OAuth2 |
|---|---|---|
| Setup complexity | Simple (API key only) | Complex (OAuth2 flow) |
| Sending limit | 100 emails/day (free tier) | ~500/day |
| Custom domain | Yes (with domain verification) | No |
| Best for | Most deployments | Personal Gmail account |

---

## Setup Steps

### 1. Create a Resend Account

Go to [resend.com](https://resend.com) and sign up for a free account.

The free tier allows **100 emails/day** and **3,000/month** — sufficient for personal deployments.

### 2. Get Your API Key

1. In the Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., `dealscrapper-prod`)
4. Set permission to **Sending access** (read-only is sufficient for sending)
5. Copy the key — it starts with `re_`

### 3. (Optional) Verify Your Domain

If you want to send from a custom address (e.g., `alerts@yourdomain.com`) instead of Resend's default `onboarding@resend.dev`:

1. In the Resend dashboard, go to **Domains**
2. Click **Add Domain** and follow the DNS verification steps
3. Once verified, you can set `EMAIL_FROM` to any address on that domain

Without domain verification, emails will send from `onboarding@resend.dev` and may land in spam.

### 4. Configure DealsScrapper

In your `.env` file:

```bash
# Select Resend as the email provider
EMAIL_PROVIDER=resend

# Your Resend API key
RESEND_API_KEY=re_your_api_key_here

# Optional: sender address (requires verified domain, see step 3)
# EMAIL_FROM=alerts@yourdomain.com
```

### 5. Test the Configuration

Start the notifier service and check the health endpoint:

```bash
curl http://localhost:3003/health
```

The response should show the email channel as healthy:

```json
{
  "email": {
    "provider": "Resend",
    "configured": true,
    "healthy": true
  }
}
```

---

## Troubleshooting

### Emails land in spam

You need a verified domain. Free-tier emails sent from `onboarding@resend.dev` will often be treated as spam. Verify your domain in the Resend dashboard (see step 3).

### `Resend API error: ...`

- Check that `RESEND_API_KEY` starts with `re_` and is not truncated
- Verify the API key is still active in the Resend dashboard (API Keys section)
- Ensure the key has **Sending access** permission

### `Resend API key is required` on startup

`RESEND_API_KEY` is not set or is empty. Verify the variable is present in your `.env` file and that the service was restarted after the change.

### Daily limit exceeded

The free tier allows 100 emails/day. If you have many active filters matching frequently, consider:
- Upgrading your Resend plan
- Switching to Gmail OAuth2 which has a higher daily limit
- Enabling email batching / digest mode (see `FUTURE_FEATURES.md`)

---

## See Also

- [Gmail OAuth2 Setup](./GMAIL_OAUTH2_SETUP.md) — alternative email provider
