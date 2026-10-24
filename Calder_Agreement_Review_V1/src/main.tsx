import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installWorkspaceApi } from "./lib/workspaceApi";
import "./styles.css";

installWorkspaceApi();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
