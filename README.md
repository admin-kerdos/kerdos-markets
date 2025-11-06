# Kérdos Markets Web

## Email sign-in (Magic Link)

Magic Link sign-in is disabled by default. To enable it, provide the following environment variables (see `.env.example`):

```
EMAIL_SIGNIN_ENABLED=true
EMAIL_FROM="Kérdos <no-reply@tudominio.com>"
EMAIL_SERVER=smtps://USER:PASS@smtp.example.com:465
# or, alternatively
# RESEND_API_KEY=your-resend-key
```

- **Token TTL**: 15 minutes. Links are single-use and the token is invalidated after the first successful verification.
- **Rate limits**: 1 request per 30 seconds per IP+email pair and up to 5 emails per hour. Exceeding the limit returns HTTP 429 with a short cooldown message.
- **Delivery**: Provide either an SMTP URI (`EMAIL_SERVER`) or a Resend API key. For SMTP delivery install `nodemailer` in your project (`npm install nodemailer`). In CI/tests you can set `EMAIL_DISABLE_DELIVERY=true` to skip actual delivery.
- **Local testing**: Run Playwright (`npx playwright test`) to exercise the full spectrum, including success, cooldown, and expiry paths. The UI shows a resend countdown and handles expired links via a modal toast.
- **Security**: Ensure `NEXTAUTH_URL` matches the public origin and use a strong `NEXTAUTH_SECRET`. Magic-link cookies remain httpOnly with CSRF protection.
