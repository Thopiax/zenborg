import React from "react";
import ReactDOM from "react-dom/client";
import { NewTab } from "./NewTab";
import "./style.css";

// kairos theme on the document root (system-aware). Same pattern as popup:
// kairos owns its own light/dark via [data-kairos-theme] (see ../../styles/tokens.css).
const media = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = (dark: boolean) =>
  document.documentElement.setAttribute("data-kairos-theme", dark ? "dark" : "light");
applyTheme(media.matches);
media.addEventListener("change", (e) => applyTheme(e.matches));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NewTab />
  </React.StrictMode>
);
