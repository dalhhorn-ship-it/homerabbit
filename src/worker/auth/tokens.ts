// Random tokens and hashes (WebCrypto only, so it runs in workerd and Node alike).
const enc = new TextEncoder();

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** 32 random bytes, base64url without padding (43 characters). */
export function randomToken(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes: 0 O 1 l I

/** 16 random characters for a one-time temporary password (rejection sampling keeps it unbiased). */
export function temporaryPassword(): string {
  let out = "";
  const limit = 256 - (256 % TEMP_ALPHABET.length);
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && out.length < 16) out += TEMP_ALPHABET[b % TEMP_ALPHABET.length];
    }
  }
  return out;
}
