// PBKDF2-SHA256 via WebCrypto, 100 000 iterations (workerd's cap; ADR 0013). The stored string carries its own
// parameters: `pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>`, so scripts/reset-password.mjs writes the same format.
import { fromBase64, toBase64 } from "./tokens";

export const ITERATIONS = 100_000;
const enc = new TextEncoder();

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$");
  const n = Number(iterations);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(n) || n < 1 || n > ITERATIONS || !salt || !hash) return false;
  try {
    return constantTimeEqual(await derive(password, fromBase64(salt), n), fromBase64(hash));
  } catch {
    return false;
  }
}

/** A well-formed hash nobody knows the password of: unknown emails are verified against it, so timing does not tell. */
export const DUMMY_HASH = `pbkdf2-sha256$${ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;
