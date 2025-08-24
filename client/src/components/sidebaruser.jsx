// src/components/Sidebar.jsx
import React from "react";
import { FaFolder, FaPlus } from "react-icons/fa";
import { NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

function Sidebar() {
  return (
    <div className="col-2 bg-white border-end p-3 vh-100">
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
