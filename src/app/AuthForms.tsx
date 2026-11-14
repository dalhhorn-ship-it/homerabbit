// Sign-up, login and must-change-password screens. Messages come from the server and stay generic by design.
import { Button, InlineNotification, PasswordInput, TextInput } from "@carbon/react";
import { type FormEvent, useState } from "react";
import { ApiError, api } from "./api";

function useSubmit(action: () => Promise<void>) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

function Problem({ text }: { text: string }) {
  return text ? (
    <InlineNotification kind="error" title="" subtitle={text} hideCloseButton lowContrast role="alert" />
  ) : null;
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="hr-card" aria-labelledby="hr-card-title">
      <h1 id="hr-card-title" className="hr-card__title">
        {title}
      </h1>
      {children}
    </section>
  );
}

interface CredentialProps {
  onDone: () => void;
  switchTo?: () => void;
  inviteToken?: string;
}

export function SignupForm({ onDone, switchTo, inviteToken }: CredentialProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit(async () => {
    await api.signup({ email, password, displayName, inviteToken });
    onDone();
  });
  return (
    <form onSubmit={submit} className="hr-form">
      <TextInput
        id="su-name"
        labelText="Your name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        autoComplete="name"
        required
        size="lg"
      />
      <TextInput
        id="su-email"
        labelText="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        size="lg"
      />
      <PasswordInput
        id="su-password"
        labelText="Password"
        helperText="At least 10 characters."
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        size="lg"
      />
      <Problem text={error} />
      <Button type="submit" size="lg" disabled={busy}>
        Create account
      </Button>
      {switchTo && (
        <Button kind="ghost" size="lg" onClick={switchTo}>
          I already have an account
        </Button>
      )}
    </form>
  );
}

export function LoginForm({ onDone, switchTo }: CredentialProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit(async () => {
    await api.login({ email, password });
    onDone();
  });
  return (
    <form onSubmit={submit} className="hr-form">
      <TextInput
        id="li-email"
        labelText="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        size="lg"
      />
      <PasswordInput
        id="li-password"
        labelText="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        size="lg"
      />
      <Problem text={error} />
      <Button type="submit" size="lg" disabled={busy}>
        Log in
      </Button>
      {switchTo && (
        <Button kind="ghost" size="lg" onClick={switchTo}>
          Create an account
        </Button>
      )}
    </form>
  );
}

export function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { error, busy, submit } = useSubmit(async () => {
    await api.changePassword({ currentPassword: current, newPassword: next });
    onDone();
  });
  return (
    <Card title="Choose a new password">
      <p className="hr-note">You signed in with a temporary password. Choose your own to continue.</p>
      <form onSubmit={submit} className="hr-form">
        <PasswordInput
          id="cp-current"
          labelText="Temporary password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          size="lg"
        />
        <PasswordInput
          id="cp-new"
          labelText="New password"
          helperText="At least 10 characters."
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          size="lg"
        />
        <Problem text={error} />
        <Button type="submit" size="lg" disabled={busy}>
          Save new password
        </Button>
      </form>
    </Card>
  );
}
