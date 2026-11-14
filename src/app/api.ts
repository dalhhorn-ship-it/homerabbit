// Plain fetch client for the Worker API (same origin, session cookie). No state library (ADR 0013).
export interface Member {
  id: string;
  email: string;
  displayName: string;
}
export interface Me {
  user: Member;
  household: { id: string; name: string };
  members: Member[];
  mustChangePassword: boolean;
}
export interface Invite {
  id: string;
  expiresAt: string;
  token: string;
  link: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "Something went wrong.");
  return data as T;
}

export const api = {
  me: () => request<Me>("GET", "/api/me"),
  signup: (b: { email: string; password: string; displayName: string; inviteToken?: string }) =>
    request<{ ok: true }>("POST", "/api/auth/signup", b),
  login: (b: { email: string; password: string }) =>
    request<{ ok: true; mustChangePassword: boolean }>("POST", "/api/auth/login", b),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout", {}),
  changePassword: (b: { currentPassword: string; newPassword: string }) =>
    request<{ ok: true }>("POST", "/api/me/password", b),
  rename: (name: string) => request<{ ok: true; name: string }>("PATCH", "/api/household", { name }),
  createInvite: () => request<Invite>("POST", "/api/invites", {}),
  openInvites: () => request<{ invites: { id: string }[] }>("GET", "/api/invites"),
  acceptInvite: (token: string) => request<{ ok: true }>("POST", "/api/invites/accept", { token }),
  resetPassword: (memberId: string) =>
    request<{ temporaryPassword: string }>("POST", `/api/members/${encodeURIComponent(memberId)}/reset-password`, {}),
};
