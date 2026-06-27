import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Apply saved preferences
const savedRadius = localStorage.getItem("planly-radius");
if (savedRadius) {
  document.documentElement.style.setProperty("--radius", `${savedRadius}rem`);
}
const savedDrawerWidth = localStorage.getItem("planly-drawer-width");
if (savedDrawerWidth) {
  document.documentElement.style.setProperty("--drawer-width", `${savedDrawerWidth}px`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);
