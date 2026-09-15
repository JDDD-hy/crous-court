import type { Locale } from "./core";

export function verificationEmail(locale: Locale, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid verification code");
  return locale === "en" ? {
    subject: "CROUS Court sign-in confirmation",
    text: `You are signing in to CROUS Court. This email only verifies access to your email address. If you did not request it, ignore it; no action is needed.\n\nVerification code: ${code}\nValid for 10 minutes. Do not forward this code.`,
    html: `<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your sign-in code is below and expires in ten minutes.</div><p>You are signing in to <strong>CROUS Court</strong>.</p><p>Verification code:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Valid for 10 minutes. Do not forward this code. If you did not request it, ignore this email.</p>`,
  } : {
    subject: "CROUS法庭登录确认",
    text: `你正在登录 CROUS法庭。此邮件只用于确认邮箱控制权；如果并非本人操作，请直接忽略，不需要采取任何措施。\n\n验证码：${code}\n10 分钟内有效，请勿转发。`,
    html: `<div style="display:none;max-height:0;overflow:hidden;opacity:0">登录确认邮件；验证码位于正文，有效期十分钟。</div><p>你正在登录 <strong>CROUS法庭</strong>。</p><p>验证码：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>10 分钟内有效，请勿转发。如果并非本人操作，请忽略此邮件。</p>`,
  };
}
