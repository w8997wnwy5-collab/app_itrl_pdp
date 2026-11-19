import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { captureInstallPrompt } from "./lib/install";
import { registerServiceWorker } from "./lib/push";
import { applyTheme, storedTheme } from "./pages/Settings";

applyTheme(storedTheme());
captureInstallPrompt();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
