import React, { useEffect, useState } from "react";
import {
  FaFolder, FaUser, FaTimes, FaShareAlt, FaClock,
  FaUsers, FaTrash, FaHome, FaFileSignature, FaUpload, FaCheckSquare
} from "react-icons/fa";
import { NavLink, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./sidebar.css";
import { BACKEND_URL } from "../config";

function Sidebar({ onClose }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const email = localStorage.getItem("email");
  const role = localStorage.getItem("role") || "faculty";
  const normalizedRole = (() => {
    const raw = String(role || "").toLowerCase();
    if (raw === "admin") return "superadmin";
    if (raw === "user") return "faculty";
    if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
    if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
    if (raw === "reviewer") return "evaluator";
    return raw;
  })();
  const canOpenDepartmentReview = normalizedRole === "dept_chair" || normalizedRole === "superadmin";
  const canOpenQaReview = normalizedRole === "qa_admin" || normalizedRole === "superadmin";
  const canOpenEvaluationStage = normalizedRole === "evaluator" || normalizedRole === "superadmin";
  const canOpenCopcUpload = normalizedRole !== "evaluator";
  const navigate = useNavigate();

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

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <>
      <div className="d-flex flex-column sidebar-admin-clean app-sidebar-shell">
        {/* Mobile close button */}
        {isMobile && (
          <div className="d-flex justify-content-end p-2 border-bottom">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <FaTimes />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="p-3 border-bottom sidebar-header-block flex-shrink-0">
          <h5 className="mb-1 text-primary">DocuDB</h5>
          <small className="text-muted">Document Management</small>
        </div>

        {/* User Info */}
        <div className="p-3 border-bottom flex-shrink-0">
          <div className="d-flex align-items-center">
            <div className="profile-picture-sidebar me-3">
              {localStorage.getItem('profilePicture') ? (
                <img
                  src={`${BACKEND_URL}/uploads/${localStorage.getItem('profilePicture')}`}
                  alt="Profile"
                  className="profile-picture-img"
                />
              ) : (
                <div className="profile-picture-placeholder-sidebar">
                  <FaUser size={16} />
                </div>
              )}
            </div>
            <div className="flex-grow-1">
              <div className="fw-medium small text-truncate" style={{maxWidth: '160px'}}>
                {email}
              </div>
              <div className="small text-muted">{role.replace(/_/g, " ")}</div>
            </div>
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-grow-1 p-2 overflow-auto">
          <div className="mb-3">
            <h6 className="px-3 py-2 mb-2 text-muted small fw-bold text-uppercase"
                style={{letterSpacing: '0.5px'}}>
              Files
            </h6>
            <ul className="nav nav-pills flex-column gap-1">
              <li className="nav-item">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                  }
                  onClick={handleLinkClick}
                >
                  <FaHome className="me-2" size={16} />
                  My Drive
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink
                  to="/shared"
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                  }
                  onClick={handleLinkClick}
                >
                  <FaShareAlt className="me-2" size={16} />
                  Shared with me
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink
                  to="/recent"
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                  }
                  onClick={handleLinkClick}
                >
                  <FaClock className="me-2" size={16} />
                  Recent
                </NavLink>
              </li>
            </ul>
          </div>

          <div className="mb-3">
            <h6 className="px-3 py-2 mb-2 text-muted small fw-bold text-uppercase"
                style={{letterSpacing: '0.5px'}}>
              Collaboration
            </h6>
            <ul className="nav nav-pills flex-column gap-1">
              <li className="nav-item">
                <NavLink
                  to="/groups"
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                  }
                  onClick={handleLinkClick}
                >
                  <FaUsers className="me-2" size={16} />
                  Groups
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink
                  to="/forms"
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                  }
                  onClick={handleLinkClick}
                >
                  <FaFileSignature className="me-2" size={16} />
                  Smart Forms
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink
                  to="/copc-workflow"
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                  }
                  onClick={handleLinkClick}
                >
                  <FaFileSignature className="me-2" size={16} />
                  COPC Workflow
                </NavLink>
              </li>
              {canOpenCopcUpload && (
                <li className="nav-item">
                  <NavLink
                    to="/copc-workflow/upload"
                    className={({ isActive }) =>
                      `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                    }
                    onClick={handleLinkClick}
                  >
                    <FaUpload className="me-2" size={16} />
                    COPC Upload
                  </NavLink>
                </li>
              )}
              {canOpenDepartmentReview && (
                <li className="nav-item">
                  <NavLink
                    to="/copc-workflow/department-review"
                    className={({ isActive }) =>
                      `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                    }
                    onClick={handleLinkClick}
                  >
                    <FaCheckSquare className="me-2" size={16} />
                    COPC Review
                  </NavLink>
                </li>
              )}
              {canOpenQaReview && (
                <li className="nav-item">
                  <NavLink
                    to="/copc-workflow/qa-review"
                    className={({ isActive }) =>
                      `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                    }
                    onClick={handleLinkClick}
                  >
                    <FaCheckSquare className="me-2" size={16} />
                    QA Compliance Review
                  </NavLink>
                </li>
              )}
              {canOpenEvaluationStage && (
                <li className="nav-item">
                  <NavLink
                    to="/copc-workflow/evaluation"
                    className={({ isActive }) =>
                      `nav-link d-flex align-items-center px-3 py-2 ${isActive ? "active text-white" : "text-dark"}`
                    }
                    onClick={handleLinkClick}
                  >
                    <FaCheckSquare className="me-2" size={16} />
                    Evaluation Stage
                  </NavLink>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h6 className="px-3 py-2 mb-2 text-muted small fw-bold text-uppercase"
                style={{letterSpacing: '0.5px'}}>
             
            </h6>
            <ul className="nav nav-pills flex-column gap-1">
              {/* Trash removed from user side */}
            </ul>
          </div>
        </nav>
      </div>
    </>
  );
}

export default Sidebar;

