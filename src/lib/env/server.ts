const trimOrUndefined = (value: string | undefined | null) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeFlag = (value: string | undefined | null): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const missing: string[] = [];

const resolvedNextAuthUrl = trimOrUndefined(process.env.NEXTAUTH_URL);
if (!resolvedNextAuthUrl) {
  missing.push("NEXTAUTH_URL");
}

const resolvedNextAuthSecret = trimOrUndefined(process.env.NEXTAUTH_SECRET);
if (!resolvedNextAuthSecret) {
  missing.push("NEXTAUTH_SECRET");
}

const googleSigninFlag = process.env.GOOGLE_SIGNIN_ENABLED;
const googleSigninEnabled = typeof googleSigninFlag === "string" ? normalizeFlag(googleSigninFlag) : true;
const resolvedGoogleClientId = trimOrUndefined(process.env.GOOGLE_CLIENT_ID);
const resolvedGoogleClientSecret = trimOrUndefined(process.env.GOOGLE_CLIENT_SECRET);

if (googleSigninEnabled) {
  if (!resolvedGoogleClientId) {
    missing.push("GOOGLE_CLIENT_ID");
  }
  if (!resolvedGoogleClientSecret) {
    missing.push("GOOGLE_CLIENT_SECRET");
  }
}

const emailSigninEnabled = normalizeFlag(process.env.EMAIL_SIGNIN_ENABLED);
const emailDeliveryDisabled = normalizeFlag(process.env.EMAIL_DISABLE_DELIVERY);
const resolvedEmailFrom = trimOrUndefined(process.env.EMAIL_FROM);
const resolvedEmailServer = trimOrUndefined(process.env.EMAIL_SERVER);
const resolvedResendApiKey = trimOrUndefined(process.env.RESEND_API_KEY);

if (emailSigninEnabled && !emailDeliveryDisabled) {
  const usingSmtp = Boolean(resolvedEmailServer);
  const usingResend = Boolean(resolvedResendApiKey);

  if (!usingSmtp && !usingResend) {
    missing.push("EMAIL_SERVER or RESEND_API_KEY");
  }

  if (usingResend && !resolvedEmailFrom) {
    missing.push("EMAIL_FROM");
  }
}

if (missing.length > 0) {
  throw new Error(
    `[auth env] Missing required environment variables: ${missing.join(
      ", "
    )}. Please define them before starting the application.`
  );
}

const normalizedNextAuthUrl = resolvedNextAuthUrl.replace(/\/+$/, "");

export const serverEnv = {
  NEXTAUTH_URL: normalizedNextAuthUrl,
  NEXTAUTH_SECRET: resolvedNextAuthSecret,
  GOOGLE_CLIENT_ID: resolvedGoogleClientId,
  GOOGLE_CLIENT_SECRET: resolvedGoogleClientSecret,
  GOOGLE_SIGNIN_ENABLED: googleSigninEnabled,
  EMAIL_SIGNIN_ENABLED: emailSigninEnabled,
  EMAIL_FROM: resolvedEmailFrom,
  EMAIL_SERVER: resolvedEmailServer,
  RESEND_API_KEY: resolvedResendApiKey,
  EMAIL_DISABLE_DELIVERY: emailDeliveryDisabled
} as const;
