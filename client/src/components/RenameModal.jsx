// ✅ RenameModal.jsx
import React, { useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

export default function RenameModal({ item, onClose, onRenamed }) {
  const [newName, setNewName] = useState(
    item.type === "file" ? item.data.originalName : item.data.name
  );
  const userId = localStorage.getItem("userId");

  const handleRename = async () => {
    if (!newName.trim()) {
      alert("Name cannot be empty");
      return;
    }

    try {
      const endpoint =
        item.type === "file"
          ? `${BACKEND_URL}/files/${item.data._id}/rename`
          : `${BACKEND_URL}/folders/${item.data._id}/rename`;

      console.log("Renaming:", endpoint, { newName, userId }); // debug

      const res = await axios.put(endpoint, { newName, userId });

      // ✅ Refresh parent state
      onRenamed(res.data);

      // ✅ Log rename success
      console.log("Rename success:", res.data);
    } catch (err) {
      console.error("Rename error:", err);
      alert("Rename failed.");
    } finally {
      onClose();
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Rename {item.type === "file" ? "File" : "Folder"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <input
              type="text"
              className="form-control"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleRename}>
              Rename
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
