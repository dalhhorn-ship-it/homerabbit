// App shell and routing (path + hash, no router library). The board is shown only to signed-in members.
import { Button, Header, HeaderGlobalBar, HeaderName } from "@carbon/react";
import { useCallback, useEffect, useState } from "react";
import { Card, ChangePassword, LoginForm, SignupForm } from "./AuthForms";
import { api, type Me } from "./api";
import { Board } from "./Board";
import { Household } from "./Household";
import { InviteAccept } from "./InviteAccept";

const RETURN_KEY = "hr_return_to";

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [path, setPath] = useState(window.location.pathname);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    setPath(window.location.pathname);
  }, []);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch {
      setMe(null); // 401: not signed in (or the server is unreachable: the login page is the safe screen)
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  // The first screen is the one asked for; after login the visitor returns there.
  const afterAuth = async () => {
    await refresh();
    const back = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    navigate(back && back.startsWith("/") && !back.startsWith("//") ? back : "/");
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setMe(null);
    navigate("/login");
  };

  if (me === undefined) return <p className="hr-loading">Loading…</p>;

  // A temporary password must be replaced before anything else, including an invite link.
  if (me?.mustChangePassword) {
    return (
      <Shell me={me} navigate={navigate} logout={logout}>
        <ChangePassword onDone={afterAuth} />
      </Shell>
    );
  }

  if (path === "/invite") {
    return (
      <Shell me={me} navigate={navigate} logout={logout}>
        <InviteAccept me={me} onJoined={afterAuth} navigate={navigate} />
      </Shell>
    );
  }

  if (!me) {
    if (path !== "/login" && path !== "/signup") sessionStorage.setItem(RETURN_KEY, path + window.location.search);
    return (
      <Shell me={null} navigate={navigate} logout={logout}>
        {path === "/signup" ? (
          <Card title="Create your account">
            <SignupForm onDone={afterAuth} switchTo={() => navigate("/login")} />
          </Card>
        ) : (
          <Card title="Log in">
            <LoginForm onDone={afterAuth} switchTo={() => navigate("/signup")} />
          </Card>
        )}
      </Shell>
    );
  }

  return (
    <Shell me={me} navigate={navigate} logout={logout}>
      {path === "/household" ? <Household me={me} onChange={refresh} /> : <Board />}
    </Shell>
  );
}

function Shell(props: {
  me: Me | null;
  navigate: (to: string) => void;
  logout: () => void;
  children: React.ReactNode;
}) {
  const { me, navigate, logout } = props;
  const full = me && !me.mustChangePassword;
  return (
    <>
      <Header aria-label="homerabbit">
        <HeaderName
          prefix=""
          href="/"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          {me ? me.household.name : "homerabbit"}
        </HeaderName>
        {me && (
          <HeaderGlobalBar>
            {full && (
              <Button kind="ghost" className="hr-header-btn" onClick={() => navigate("/household")}>
                Household
              </Button>
            )}
            <Button kind="ghost" className="hr-header-btn" onClick={logout}>
              Log out
            </Button>
          </HeaderGlobalBar>
        )}
      </Header>
      <main className={full && window.location.pathname !== "/household" ? "hr-main" : "hr-page"}>
        {props.children}
      </main>
    </>
  );
}
