// src/components/Navbar.jsx
import React, { useState } from "react";
import { FaPlus, FaSearch, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import logo from "../assets/docudbllcc.png";
import Upload from "../pages/upload";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Navbar.css"; // We'll create this for custom styling

function Navbar() {
  const navigate = useNavigate();

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
              style={{ height: "50px", marginLeft:"100px", position:"inherit"}}
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
                className="btn btn-sm btn-outline-danger d-flex align-items-center"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="me-1" /> Logout
              </button>
            </div>
          </div>
        </nav>
      </div>

      

      
    </>
  );
}

export default Navbar;