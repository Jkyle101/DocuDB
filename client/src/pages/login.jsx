import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import logo from "../assets/dblogo2.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // Use backend IP (localhost for dev, server LAN IP for other devices)
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

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
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card p-4 shadow-lg" style={{ width: "350px" }}>
        <img src={logo} alt="DocuDB Logo" className="mb-3" />
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Email address</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter email"
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
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-100">
            Login
          </button>

          <h1 className="foter">version 3.1.0 | Made Prodly by LLCC Students</h1>
        </form>
      </div>
    </div>
  );
}

export default Login;
