// Household settings: rename, members (with reset), invite link with Copy and Share.
import { Button, InlineNotification, TextInput } from "@carbon/react";
import { type FormEvent, useEffect, useState } from "react";
import { Card } from "./AuthForms";
import { ApiError, api, type Me } from "./api";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [state, setState] = useState("");
  return (
    <div className="hr-copy">
      <TextInput id={id} labelText={label} value={value} readOnly size="lg" onFocus={(e) => e.target.select()} />
      <Button
        kind="tertiary"
        size="lg"
        onClick={async () => setState((await copy(value)) ? "Copied" : "Press and hold the text to copy")}
      >
        Copy
      </Button>
      <span role="status" className="hr-note">
        {state}
      </span>
    </div>
  );
}

function Rename({ me, onChange }: { me: Me; onChange: () => void }) {
  const [name, setName] = useState(me.household.name);
  const [msg, setMsg] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.rename(name);
      setMsg("Saved");
      onChange();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Could not save.");
    }
  };
  return (
    <form onSubmit={submit} className="hr-form" aria-label="Rename household">
      <TextInput
        id="hh-name"
        labelText="Household name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        size="lg"
      />
      <Button type="submit" size="lg">
        Save name
      </Button>
      <span role="status" className="hr-note">
        {msg}
      </span>
    </form>
  );
}

function Members({ me }: { me: Me }) {
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState("");
  const reset = async (id: string, email: string) => {
    setError("");
    try {
      setTemp({ email, password: (await api.resetPassword(id)).temporaryPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset.");
    }
  };
  return (
    <>
      <h2 className="hr-h2">Members</h2>
      <ul className="hr-members" aria-label="Members">
        {me.members.map((m) => (
          <li key={m.id} className="hr-member">
            <span>
              <strong>{m.displayName}</strong>
              <br />
              <span className="hr-note">{m.email}</span>
            </span>
            {m.id === me.user.id ? (
              <span className="hr-note">You</span>
            ) : (
              <Button kind="tertiary" size="lg" onClick={() => reset(m.id, m.email)}>
                Reset password
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <InlineNotification kind="error" title="" subtitle={error} hideCloseButton lowContrast />}
      {temp && (
        <div className="hr-temp" role="status">
          <p>
            Temporary password for {temp.email}. It is shown only once: share it privately. They must choose a new one
            at their next login.
          </p>
          <CopyField id="temp-password" label="Temporary password" value={temp.password} />
        </div>
      )}
    </>
  );
}

function Invites() {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const refresh = () =>
    api
      .openInvites()
      .then((r) => setOpen(r.invites.length))
      .catch(() => setOpen(null));
  useEffect(() => {
    refresh();
  }, []);
  const create = async () => {
    setError("");
    try {
      const inv = await api.createInvite();
      setLink(`${window.location.origin}${inv.link}`);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the link.");
    }
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <>
      <h2 className="hr-h2">Invite</h2>
      <p className="hr-note">A link lets one person join this household. It works once and expires after 7 days.</p>
      <Button size="lg" onClick={create}>
        Create invite link
      </Button>
      {error && <InlineNotification kind="error" title="" subtitle={error} hideCloseButton lowContrast />}
      {link && (
        <div className="hr-temp">
          <CopyField id="invite-link" label="Invite link" value={link} />
          {canShare && (
            <Button
              kind="ghost"
              size="lg"
              onClick={() => navigator.share({ title: "Join our household", url: link }).catch(() => {})}
            >
              Share
            </Button>
          )}
        </div>
      )}
      {open !== null && <p className="hr-note">{open} open invite link(s)</p>}
    </>
  );
}

export function Household({ me, onChange }: { me: Me; onChange: () => void }) {
  return (
    <Card title="Household">
      <Rename key={me.household.name} me={me} onChange={onChange} />
      <Members me={me} />
      <Invites />
    </Card>
  );
}
