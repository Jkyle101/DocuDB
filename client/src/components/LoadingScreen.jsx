import React from "react";
import logo from "../assets/docudbllcc.png";
import "./loading-screen.css";

function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="app-loading-overlay" role="status" aria-live="polite">
      <div className="app-loading-card">
        <img src={logo} alt="DocuDB" className="app-loading-logo" />
        <div className="app-loading-spinner" />
        <p className="app-loading-text">{message}</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
