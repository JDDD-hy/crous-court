declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AUTH_HMAC_SECRET?: string;
    AUTH_MODE?: "local" | "local-resend" | "resend";
    RESEND_API_KEY?: string;
    OTP_FROM_EMAIL?: string;
    ADMIN_EMAILS?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
    AI_MODEL?: string;
    DEEPL_API_KEY?: string;
  }
}
