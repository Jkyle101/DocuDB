// src/components/SidebarSuperAdmin.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaUsers, FaCog, FaDatabase, FaPlus, FaClock } from "react-icons/fa";
import Upload from "../pages/upload";
import "bootstrap/dist/css/bootstrap.min.css";

function SidebarSuperAdmin() {
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  

  return (
    <>
    <div className="col-2 bg-white border-end p-3 d-flex flex-column justify-content-between">
      <div>
        

        {/* Menu */}
        <ul className="list-unstyled">
          <li className="mb-2">
            <Link to="/admin/drive" className="text-decoration-none text-dark fw-semibold">
              <FaUsers className="me-2 text-secondary" /> Manage Users 
            </Link>
          </li>
          <li className="mb-2">
            <Link to="/admin/shared" className="text-decoration-none text-dark">
              <FaDatabase className="me-2 text-secondary" /> System Logs
            </Link>
          </li>
          <li className="mb-2">
            <Link to="/admin/recent" className="text-decoration-none text-dark">
              <FaClock className="me-2 text-secondary" /> Recent
            </Link>
          </li>
          <li className="mb-2">
            <Link to="/admin/trash" className="text-decoration-none text-dark">
              <FaCog className="me-2 text-secondary" /> Settings
            </Link>
          </li>
        </ul>
      </div>

      
    </div>
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

export default SidebarSuperAdmin;
