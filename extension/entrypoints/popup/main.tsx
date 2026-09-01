import React from "react";
import ReactDOM from "react-dom/client";
import { Popup } from "./Popup";
import "./style.css";

// kairos theme on the document root (system-aware). Popup is kairos-owned, so it
// carries kairos's own light/dark via [data-kairos-theme] (see ../../styles/tokens.css).
const media = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = (dark: boolean) =>
  document.documentElement.setAttribute(
    "data-kairos-theme",
    dark ? "dark" : "light"
  );
applyTheme(media.matches);
media.addEventListener("change", (e) => applyTheme(e.matches));

// Dev-only Playwright inspection hook. Dynamic import so the inspection
// module — and its chrome.storage watchers — never ships in a production
// bundle; `browser_evaluate` reads `window.__kairos` in dev builds only.
if (import.meta.env.DEV) {
  import("@/modules/fence/inspect").then(({ loadInspection }) => {
    loadInspection().then((inspection) => {
      (window as any).__kairos = inspection;
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
