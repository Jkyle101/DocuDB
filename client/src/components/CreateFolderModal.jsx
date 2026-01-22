import React, { useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

export default function CreateFolderModal({ onClose, onCreated, parentFolder }) {
  const [name, setName] = useState("");

  const createFolder = async (e) => {
    e.preventDefault();
    try {
      const owner = localStorage.getItem("userId"); // match backend naming

      const { data } = await axios.post(`${BACKEND_URL}/folders`, {
        name,
        owner,
        parentFolder: parentFolder || null,
      });

      onCreated(data.folder);
      onClose();
    } catch (err) {
      console.error("Create folder failed:", err.response?.data || err.message);
      alert(err.response?.data?.error || "Error creating folder");
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered ">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">New Folder</h5>
          </div>
          <form onSubmit={createFolder}>
            <div className="modal-body">
              <input
                className="form-control"
                placeholder="Folder name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-light" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
