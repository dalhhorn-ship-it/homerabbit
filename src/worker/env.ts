// Worker bindings and the per-request context. Minimal D1 types: the Worker uses only what is listed here.
import type { AuthService } from "./auth/service";
import type { Repo } from "./repo";

export interface D1Result<T = unknown> {
  results: T[];
  meta: { changes: number };
}
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1 {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

export interface Bindings {
  DB: D1;
  /** Private photo bucket (HR-3); unused until then. */
  PHOTOS: unknown;
}

export interface Session {
  userId: string;
  householdId: string;
  mustChangePassword: boolean;
}

export interface Variables {
  auth: AuthService;
  session: Session;
  repo: Repo;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
