// src/components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { FaFolder } from "react-icons/fa";
import { NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

function Sidebar() {
  const [userEmail, setUserEmail] = useState("");
  const email = localStorage.getItem("email"); // Assuming userId is stored in localStorage

  useEffect(() => {
    // Example: Get email from localStorage (or context if you have one)
    const email = localStorage.getItem("userEmail") || "guest@example.com";
    setUserEmail(email);
  }, []);

  return (
    <div className="col-2 bg-white border-end p-3 vh-100">
      {/* Welcome message */}
      <div className="mb-3 p-2 bg-light rounded text-center">
        <small className="text-muted">Welcome</small>
        <div className="fw-bold text-truncate" style={{ maxWidth: "100%" }}>
          {email}
        </div>
      </div>

      {/* Sidebar Links */}
      <ul className="list-unstyled">
        <li className="mb-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `text-decoration-none fw-semibold d-flex align-items-center ${
                isActive ? "text-primary" : "text-dark"
              }`
            }
          >
            <FaFolder className="me-2 text-warning" /> My Drive
          </NavLink>
        </li>

        <li className="mb-2">
          <NavLink
            to="/shared"
            className={({ isActive }) =>
              `text-decoration-none d-flex align-items-center ${
                isActive ? "text-primary" : "text-dark"
              }`
            }
          >
            <FaFolder className="me-2 text-secondary" /> Shared with me
          </NavLink>
        </li>

        <li className="mb-2">
          <NavLink
            to="/recent"
            className={({ isActive }) =>
              `text-decoration-none d-flex align-items-center ${
                isActive ? "text-primary" : "text-dark"
              }`
            }
          >
            <FaFolder className="me-2 text-secondary" /> Recent
          </NavLink>
        </li>

        <li className="mb-2">
          <NavLink
            to="/trash"
            className={({ isActive }) =>
              `text-decoration-none d-flex align-items-center ${
                isActive ? "text-primary" : "text-dark"
              }`
            }
          >
            <FaFolder className="me-2 text-secondary" /> Trash
          </NavLink>
        </li>
      </ul>
    </div>
  );
}

export default Sidebar;
