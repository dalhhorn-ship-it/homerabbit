import type { Context } from "hono";
import type { Failure } from "../auth/service";

/** The JSON object body, or {} when there is none or it is not an object. */
export async function readBody(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function refuse(c: Context, f: Failure) {
  if (f.retryAfter) c.header("Retry-After", String(f.retryAfter));
  return c.json({ error: f.error }, f.status);
}
