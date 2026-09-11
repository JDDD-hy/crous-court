declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AUTH_HMAC_SECRET?: string;
    AUTH_MODE?: "local" | "resend";
    RESEND_API_KEY?: string;
    OTP_FROM_EMAIL?: string;
  }
}
