import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UploadManagerProvider } from "./context/UploadManagerContext";
import "./index.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const storedUserId = localStorage.getItem("userId");
const savedPrefs = storedUserId ? localStorage.getItem(`userPreferences_${storedUserId}`) : null;
if (savedPrefs) {
  try {
    const parsed = JSON.parse(savedPrefs);
    document.body.classList.toggle("dark-mode", !!parsed.darkMode);
  } catch {
    document.body.classList.remove("dark-mode");
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UploadManagerProvider>
      <App />
    </UploadManagerProvider>
  </React.StrictMode>
);
