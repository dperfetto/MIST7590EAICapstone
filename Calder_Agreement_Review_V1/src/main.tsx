import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installWorkspaceApi } from "./lib/data";
import "./styles.css";
import "./slabstax-shell.css";
import "./review-queue.css";

installWorkspaceApi();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
