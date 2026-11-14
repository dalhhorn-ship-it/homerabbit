import { Header, HeaderName } from "@carbon/react";
import { Board } from "./Board";

export function App() {
  return (
    <>
      <Header aria-label="homerabbit">
        <HeaderName prefix="" href="/">
          homerabbit
        </HeaderName>
      </Header>
      <main className="hr-main">
        <Board />
      </main>
    </>
  );
}
