import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

/** Shows the error on screen instead of a blank page if anything ever throws while rendering. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 640, margin: "64px auto", padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, color: "#475467" }}>{this.state.error.message}</p>
        <button onClick={() => { window.location.hash = ""; window.location.reload(); }}
          style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: "#4338CA", color: "#fff" }}>
          Reload
        </button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>,
);