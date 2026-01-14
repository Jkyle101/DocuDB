// src/components/SidebarSuperAdmin.jsx
import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  FaUsers,
  FaCog,
  FaDatabase,
  FaClock,
  FaUser,
  FaFile,
  FaTimes,
  FaUserFriends,
} from "react-icons/fa";
import Upload from "../pages/upload";
import "bootstrap/dist/css/bootstrap.min.css";
import "./sidebar.css";
function SidebarSuperAdmin({ onClose }) {  
  const [showUpload, setShowUpload] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "admin@example.com";
    setUserEmail(email);
    
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
    <>
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
              {userEmail}
            </div>
            <small className="text-muted">Super Admin</small>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-grow-1">
          <ul className="nav nav-pills flex-column gap-2">
            <li className="nav-item">
              <NavLink
                to="/admin/manageusers"
                className={({ isActive }) =>
                  `nav-link d-flex align-items-center rounded ${
                    isActive ? "active bg-primary text-white" : "text-dark"
                  }`
                }
                onClick={handleLinkClick}
              >
                <FaUsers className="me-2" />
                Manage Users
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink
                to="/admin/systemlogs"
                className={({ isActive }) =>
                  `nav-link d-flex align-items-center rounded ${
                    isActive ? "active bg-primary text-white" : "text-dark"
                  }`
                }
                onClick={handleLinkClick}
              >
                <FaDatabase className="me-2" />
                System Logs
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink
                to="/admin/"
                className={({ isActive }) =>
                  `nav-link d-flex align-items-center rounded ${
                    isActive ? "active bg-primary text-white" : "text-dark"
                  }`
                }
                onClick={handleLinkClick}
              >
                <FaFile className="me-2" />
                Documents
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink
                to="/admin/groups"
                className={({ isActive }) =>
                  `nav-link d-flex align-items-center rounded ${
                    isActive ? "active bg-primary text-white" : "text-dark"
                  }`
                }
                onClick={handleLinkClick}
              >
                <FaUserFriends className="me-2" />
                Groups
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Upload Document</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowUpload(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <Upload onClose={() => setShowUpload(false)} />
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={() => setShowUpload(false)}
          ></div>
        </>
      )}
    </>
  );
}

export default SidebarSuperAdmin;
