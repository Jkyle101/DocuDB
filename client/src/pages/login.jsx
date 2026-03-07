import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import logo from "../assets/dblogo2.png";
import { BACKEND_URL } from "../config";
import "./login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    axios
    .post(`${BACKEND_URL}/login`, { email, password })
      .then((result) => {
        // Success 200
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("role", result.data.role);
        localStorage.setItem("userId", result.data.userId);
        localStorage.setItem("email", email);

        if (result.data.role === "admin") navigate("/admin");
        else navigate("/");
      })
      .catch((err) => {
        if (err.response) {
          // Backend responded with 4xx/5xx
          alert(err.response.data.error || "Login failed");
        } else {
          // Network or other errors
          alert("Network error: " + err.message);
        }
      });
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-card card">
          <div className="login-brand">
            <img src={logo} alt="DocuDB Logo" className="login-logo" />
            <h1>Welcome to DocuDB</h1>
            <p>Sign in to continue to your document workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="mb-3">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100">
              Sign in
            </button>
          </form>

          <p className="login-version">Version 3.1.0 | Made proudly by LLCC students</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
