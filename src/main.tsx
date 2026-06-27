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
const savedFontFamily = localStorage.getItem("planly-font-family");
if (savedFontFamily) {
  const fonts = savedFontFamily.split(",").map(s => s.trim()).filter(Boolean);
  if (fonts.length > 0) {
    const cssValue = fonts.map(f => `'${f}'`).join(", ") + ", 'Geist Variable', sans-serif";
    document.documentElement.style.setProperty("--app-font-family", cssValue);
  }
}
const savedFontSize = localStorage.getItem("planly-font-size");
if (savedFontSize) {
  document.documentElement.style.setProperty("--app-font-size", `${savedFontSize}px`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);
