import React, { useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";


export default function UploadModal({ onClose, onUploaded, parentFolder }) {
  const [file, setFile] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please choose a file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", localStorage.getItem("userId"));
      formData.append("role", localStorage.getItem("role")); // optional
      if (parentFolder) formData.append("parentFolder", parentFolder);

      const { data } = await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (onUploaded) onUploaded(data.file);
      onClose();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please check backend logs.");
    }
  };

  return (
    <div className="modal d-block " tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered ">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload File</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={submit}>
            <div className="modal-body">
              <input
                type="file"
                className="form-control"
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success">
                Upload
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
