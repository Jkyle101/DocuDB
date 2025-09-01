import { Navigate } from "react-router-dom";
import React from "react";

function ProtectedRoute({ children, allowedRole }) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const role = localStorage.getItem("role");

  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }

  if (allowedRole && role !== allowedRole) {
    // 🚫 prevent users from accessing admin routes & vice versa
    return <Navigate to="/login" />;
  }

  return children;
}

export default ProtectedRoute;
