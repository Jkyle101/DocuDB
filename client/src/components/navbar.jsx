// src/components/Navbar.jsx
import React, { useState } from "react";
import { FaPlus, FaSearch, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import logo from "../assets/dblogo2.png";
import Upload from "../pages/upload"; // ✅ import upload form
import "bootstrap/dist/css/bootstrap.min.css";

function Navbar() {
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false); // modal toggle

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    navigate("/login");
  };

  return (
    <>
      <nav className="navbar navbar-light bg-light px-3 shadow-sm">
        {/* Brand */}
        <img
          src={logo}
          alt=""
          style={{ height: "100px", margin: "0 0 0 70px" }}
        />

        {/* Search bar */}
        <form className="d-flex w-50">
          <input
            className="form-control me-2"
            type="search"
            placeholder="Search in Drive"
          />
          <button className="btn btn-outline-primary" type="submit">
            <FaSearch />
          </button>
        </form>

        {/* Action buttons */}
        <div className="d-flex align-items-center">
          {/* ✅ Open modal instead of navigate */}
          <button
            className="btn btn-primary rounded-circle me-2"
            onClick={() => setShowUpload(true)}
          >
            <FaPlus />
          </button>
          <button className="btn btn-outline-danger" onClick={handleLogout}>
          <FaSignOutAlt className="me-2" /> Logout
          </button>
        </div>
      </nav>

      {/* ✅ Modal for Upload */}
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

      {/* ✅ Backdrop */}
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
