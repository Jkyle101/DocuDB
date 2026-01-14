import React, { useEffect, useState } from "react";
import { FaFolder, FaUser, FaTimes } from "react-icons/fa";
import { NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

function Sidebar({ onClose }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const email = localStorage.getItem("email");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div
      className="d-flex flex-column bg-light border-end sidebar-container"
      style={{ width: "250px", height: "100vh", padding: "1.5rem" }}
    >
      {/* Mobile close button */}
      {isMobile && (
        <div className="d-flex justify-content-end mb-3">
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <FaTimes />
          </button>
        </div>
      )}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
            >
              <FaFolder className="me-2" />
              Recent
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/groups"
              className={({ isActive }) =>
                `nav-link d-flex align-items-center rounded ${
                  isActive ? "active bg-primary text-white" : "text-dark"
                }`
              }
              onClick={handleLinkClick}
            >
              <FaFolder className="me-2" />
              Groups
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
              onClick={handleLinkClick}
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
