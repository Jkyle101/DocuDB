// src/components/Sidebar.jsx
import React from "react";
import { FaFolder, FaPlus } from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";

function Sidebar() {
  return (
    <div className="col-2 bg-white border-end p-3">
      <button className="btn btn-primary w-100 mb-3">
        <FaPlus className="me-2" /> New
      </button>
      <ul className="list-unstyled">
        <li className="mb-2">
          <a href="#" className="text-decoration-none text-dark fw-semibold">
            <FaFolder className="me-2 text-warning" /> My Drive
          </a>
        </li>
        <li className="mb-2">
          <a href="#" className="text-decoration-none text-dark">
            <FaFolder className="me-2 text-secondary" /> Shared with me
          </a>
        </li>
        <li className="mb-2">
          <a href="#" className="text-decoration-none text-dark">
            <FaFolder className="me-2 text-secondary" /> Recent
          </a>
        </li>
        <li className="mb-2">
          <a href="#" className="text-decoration-none text-dark">
            <FaFolder className="me-2 text-secondary" /> Trash
          </a>
        </li>
      </ul>
    </div>
  );
}

export default Sidebar;
