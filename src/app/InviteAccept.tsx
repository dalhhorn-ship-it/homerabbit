// /invite#<token>: a new person signs up into the household, an existing account logs in (or is already logged in)
// and then joins. The token lives in the URL fragment, so it never reaches server logs or Referer headers.
import { Button, InlineNotification } from "@carbon/react";
import { useState } from "react";
import { Card, LoginForm, SignupForm } from "./AuthForms";
import { ApiError, api, type Me } from "./api";

interface Props {
  me: Me | null;
  onJoined: () => Promise<void>;
  navigate: (to: string) => void;
}

export function InviteAccept({ me, onJoined, navigate }: Props) {
  const token = window.location.hash.slice(1);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState("");

  const join = async () => {
    setError("");
    try {
      await api.acceptInvite(token);
      window.history.replaceState(null, "", "/");
      await onJoined();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join.");
    }
  };

  if (!token) {
    return (
      <Card title="Invite">
        <p className="hr-note">This invite link is not valid.</p>
        <Button size="lg" onClick={() => navigate("/")}>
          Go to homerabbit
        </Button>
      </Card>
    );
  }

  if (me) {
    return (
      <Card title="Join a household">
        <p className="hr-note">
          You are signed in as {me.user.email}. Joining replaces your own household, which must be empty.
        </p>
        {error && (
          <InlineNotification kind="error" title="" subtitle={error} hideCloseButton lowContrast role="alert" />
        )}
        <Button size="lg" onClick={join}>
          Join this household
        </Button>
      </Card>
    );
  }

  return (
    <Card title={mode === "signup" ? "Join with a new account" : "Join with your account"}>
      {mode === "signup" ? (
        <SignupForm
          inviteToken={token}
          onDone={async () => {
            window.history.replaceState(null, "", "/");
            await onJoined();
          }}
          switchTo={() => setMode("login")}
        />
      ) : (
        <LoginForm onDone={join} switchTo={() => setMode("signup")} />
      )}
      {error && <InlineNotification kind="error" title="" subtitle={error} hideCloseButton lowContrast role="alert" />}
    </Card>
  );
}
