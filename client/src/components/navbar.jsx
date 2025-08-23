// src/components/Navbar.jsx
import React, { useState } from "react";
import { FaPlus, FaSearch, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import logo from "../assets/dblogo2.png";
import Upload from "../pages/upload";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Navbar.css"; // We'll create this for custom styling

function Navbar() {
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    navigate("/login");
  };

  return (
    <>
      <div className="navbar-container">
        <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
          {/* Brand */}
          <a className="navbar-brand d-flex align-items-center" href="/">
            <img
              src={logo}
              alt="DocuDB"
              style={{ height: "50px", marginLeft:"50px" }}
              className="me-2"
            />
          </a>

          {/* Toggler (mobile) */}
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarContent"
            aria-controls="navbarContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Navbar content */}
          <div className="collapse navbar-collapse" id="navbarContent">
            {/* Search bar */}
            <form className="d-flex mx-auto w-75 w-lg-50">
              <input
                className="form-control form-control-sm me-2"
                type="search"
                placeholder="Search in Drive"
              />
              <button className="btn btn-sm btn-outline-primary" type="submit">
                <FaSearch />
              </button>
            </form>

            {/* Action buttons */}
            <div className="d-flex align-items-center ms-lg-3">
              <button
                className="btn btn-sm btn-primary rounded-circle me-2"
                onClick={() => setShowUpload(true)}
                title="Upload"
              >
                <FaPlus />
              </button>
              <button
                className="btn btn-sm btn-outline-danger d-flex align-items-center"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="me-1" /> Logout
              </button>
            </div>
          </div>
        </nav>
      </div>

      {/* Upload Modal */}
      {showUpload && (
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
      )}

      {/* Backdrop */}
      {showUpload && (
        <div
          className="modal-backdrop fade show"
          onClick={() => setShowUpload(false)}
        ></div>
      )}
    </>
  );
}

export default Navbar;