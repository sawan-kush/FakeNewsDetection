import { useEffect, useState } from "react";
import { Layout, Route } from "./components/Layout";
import { AnalyzePage } from "./pages/AnalyzePage";
import { HistoryPage } from "./pages/HistoryPage";

function parse(hash: string): Route {
  return hash.startsWith("#/history") ? "history" : "analyze";
}

export default function App() {
  const [route, setRoute] = useState<Route>(parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return (
    <Layout route={route}>
      {route === "analyze" && <AnalyzePage />}
      {route === "history" && <HistoryPage />}
    </Layout>
  );
}