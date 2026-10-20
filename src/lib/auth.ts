import crypto from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const SESSION = "zl_session";
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(key());
  (await cookies()).set(SESSION, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION);
}

export async function currentUser() {
  const token = (await cookies()).get(SESSION)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return await db.user.findUnique({ where: { id: String(payload.uid) } });
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please login to continue");
  return u;
}

export const isAdmin = (email: string) =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

// ---- OTP (emailed) ----
const hashOtp = (email: string, code: string) =>
  crypto.createHmac("sha256", key()).update(`${email}:${code}`).digest("hex");

// Twilio Verify sends and checks the code over its email channel (needs a SendGrid email integration on the Verify service).
// Without TWILIO_* (dev only) we fall back to a locally stored, hashed code.
function twilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim(), token = process.env.TWILIO_AUTH_TOKEN?.trim(), service = process.env.TWILIO_VERIFY_SID?.trim();
  return sid && token && service ? { sid, token, service } : null;
}

// Direct SendGrid email: we generate and hash the code ourselves, so no Twilio is needed.
function sendgrid() {
  const key = process.env.SENDGRID_API_KEY?.trim(), from = process.env.SENDGRID_FROM_EMAIL?.trim();
  return key && from ? { key, from } : null;
}

async function twilioVerify(path: "Verifications" | "VerificationCheck", email: string, extra: Record<string, string> = {}) {
  const t = twilio()!;
  const res = await fetch(`https://verify.twilio.com/v2/Services/${t.service}/${path}`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${t.sid}:${t.token}`).toString("base64") },
    body: new URLSearchParams({ To: email, ...extra }),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string } };
}

const upsertUser = (email: string) => db.user.upsert({ where: { email }, update: {}, create: { email } });

/** Sends an OTP. Returns the code only in local dev (no Twilio); with Twilio the code never touches our server. */
export async function issueOtp(email: string) {
  const recent = await db.otpCode.count({ where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
  if (recent >= 5) throw new HttpError(429, "Too many OTP requests. Please try again after some time.");
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  if (twilio()) {
    // Row only counts sends for the rate limit above; Twilio holds the real code.
    await db.otpCode.create({ data: { email, codeHash: "twilio", expiresAt } });
    const { status, data } = await twilioVerify("Verifications", email, { Channel: "email" });
    if (status >= 400) console.error("[twilio] send failed", status, data.code, data.message);
    if (status === 429) throw new HttpError(429, "Too many OTP requests. Please try again after some time.");
    if (status >= 400) throw new HttpError(502, "Could not send OTP. Please try again.");
    return null;
  }
  const mail = sendgrid();
  if (!mail && process.env.NODE_ENV === "production") throw new Error("OTP email is not configured (set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL, or TWILIO_*)");
  const code = String(crypto.randomInt(100000, 1000000));
  await db.otpCode.create({ data: { email, codeHash: hashOtp(email, code), expiresAt } });
  if (mail) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${mail.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: mail.from, name: "Zari Lane" },
        subject: `Your Zari Lane login code: ${code}`,
        content: [{ type: "text/plain", value: `Your Zari Lane verification code is ${code}. It expires in 5 minutes.` }],
      }),
    });
    if (!res.ok) {
      console.error("[sendgrid] send failed", res.status, await res.text().catch(() => ""));
      throw new HttpError(502, "Could not send OTP. Please try again.");
    }
    return null;
  }
  console.log(`[otp] ${email}: ${code}`);
  return code;
}

export async function checkOtp(email: string, code: string) {
  if (twilio()) {
    const { status, data } = await twilioVerify("VerificationCheck", email, { Code: code });
    if (status >= 400 && status !== 404) console.error("[twilio] check failed", status, data.code, data.message);
    if (status === 404) throw new HttpError(400, "OTP expired. Please request a new one.");
    if (status === 429) throw new HttpError(429, "Too many wrong attempts. Please request a new OTP.");
    if (status >= 400) throw new HttpError(502, "Could not verify OTP. Please try again.");
    if (data.status !== "approved") throw new HttpError(400, "Incorrect OTP. Please try again.");
    return upsertUser(email);
  }
  const otp = await db.otpCode.findFirst({ where: { email, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, "OTP expired. Please request a new one.");
  if (otp.attempts >= 5) throw new HttpError(429, "Too many wrong attempts. Please request a new OTP.");
  if (otp.codeHash !== hashOtp(email, code)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Incorrect OTP. Please try again.");
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  return upsertUser(email);
}
