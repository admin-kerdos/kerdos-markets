const trimOrUndefined = (value: string | undefined | null) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

const resolvedGoogleClientId = trimOrUndefined(process.env.GOOGLE_CLIENT_ID);
if (!resolvedGoogleClientId) {
  missing.push("GOOGLE_CLIENT_ID");
}

const resolvedGoogleClientSecret = trimOrUndefined(process.env.GOOGLE_CLIENT_SECRET);
if (!resolvedGoogleClientSecret) {
  missing.push("GOOGLE_CLIENT_SECRET");
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
  GOOGLE_CLIENT_SECRET: resolvedGoogleClientSecret
} as const;
