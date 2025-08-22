import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import logo from "../assets/dblogo2.png"

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    axios
      .post("http://localhost:3001/login", { email, password })
      .then((result) => {
        if (result.data.status === "success") {
          // Save login info
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("role", result.data.role);   // 🔑 save role
          localStorage.setItem("userId", result.data.userId); // 🔑 save userId
  
          // Redirect based on role
          if (result.data.role === "admin") {
            navigate("/admin");   
          } else {
            navigate("/");        
          }
        } else {
          alert(result.data); // "No record Found" or "The password is incorrect"
        }
      })
      .catch((err) => console.log(err));
  };
  
  

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card p-4 shadow-lg" style={{ width: "350px" }}>
        <img src={logo} style={{height:""}} />
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
        </form>
      </div>
    </div>
  );
}

export default Login;
