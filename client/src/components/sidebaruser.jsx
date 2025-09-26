import React, { useEffect, useState } from "react";
import { FaFolder, FaUser } from "react-icons/fa";
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
    <div
      className="d-flex flex-column bg-light border-end"
      style={{ width: "250px", height: "100vh", padding: "1.5rem" }}
    >
      {/* User Info */}
      <div className="d-flex align-items-center mb-4">
        <FaUser className="text-primary me-3" />
        <div>
          <div className="fw-bold text-truncate" style={{ maxWidth: "180px" }}>
            {email}
          </div>
          <small className="text-muted">Welcome back!</small>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-grow-1">
        <ul className="nav nav-pills flex-column gap-2">
          <li className="nav-item">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `nav-link d-flex align-items-center rounded ${
                  isActive ? "active bg-primary text-white" : "text-dark"
                }`
              }
            >
              <FaFolder className="me-2" />
              My Drive
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/shared"
              className={({ isActive }) =>
                `nav-link d-flex align-items-center rounded ${
                  isActive ? "active bg-primary text-white" : "text-dark"
                }`
              }
            >
              <FaFolder className="me-2" />
              Shared with me
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/recent"
              className={({ isActive }) =>
                `nav-link d-flex align-items-center rounded ${
                  isActive ? "active bg-primary text-white" : "text-dark"
                }`
              }
            >
              <FaFolder className="me-2" />
              Recent
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/trash"
              className={({ isActive }) =>
                `nav-link d-flex align-items-center rounded ${
                  isActive ? "active bg-primary text-white" : "text-dark"
                }`
              }
            >
              <FaFolder className="me-2" />
              Trash
            </NavLink>
          </li>
        </ul>
      </nav>

    </div>
  );
}

export default Sidebar;
