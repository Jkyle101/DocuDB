import React, { useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

function Upload({ onClose, currentFolderId }) {
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please choose a file");

    const formData = new FormData();
    formData.append("file", file);

    // attach logged-in userId from localStorage
    formData.append("userId", localStorage.getItem("userId")); 

    // include folder (if inside one)
    if (currentFolderId) {
      formData.append("parentFolder", currentFolderId);
    }

    try {
      await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("File uploaded successfully!");
      if (onClose) onClose(true); // pass true to indicate refresh needed
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        className="form-control mb-3"
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button type="submit" className="btn btn-success">
        Upload
      </button>
    </form>
  );
}

export default Upload;
