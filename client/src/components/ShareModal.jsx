import React, { useState } from "react";
import axios from "axios";
const API = "http://localhost:3001";

export default function ShareModal({ onClose, target }) {
  const [emails, setEmails] = useState(""); // comma separated emails
  const [permission, setPermission] = useState("read");

  const submit = async () => {
    // backend will resolve emails → userIds
    const body = { emails: emails.split(",").map(s=>s.trim()).filter(Boolean), permission };
    if (target.type === "file") {
      await axios.patch(`${API}/files/${target.item._id}/share`, body);
    } else {
      await axios.patch(`${API}/folders/${target.item._id}/share`, body);
    }
    onClose();
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog"><div className="modal-content">
        <div className="modal-header"><h5 className="modal-title">Share {target.type}</h5></div>
        <div className="modal-body">
          <label className="form-label">User emails (comma separated)</label>
          <input className="form-control mb-3" value={emails} onChange={(e)=>setEmails(e.target.value)} placeholder="user1@acme.com, user2@acme.com" />
          <label className="form-label">Permission</label>
          <select className="form-select" value={permission} onChange={(e)=>setPermission(e.target.value)}>
            <option value="read">Read</option>
            <option value="write">Write</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-light" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Share</button>
        </div>
      </div></div>
    </div>
  );
}
