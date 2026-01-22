import React, { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

export default function MoveModal({ onClose, target, currentFolder, onMoved }) {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [allFolders, setAllFolders] = useState([]);
  const [dest, setDest] = useState(currentFolder || "");

  // Load all folders user can see
  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/folders/all`, { params: { userId, role } })
      .then((res) => setAllFolders(res.data))
      .catch(console.error);
  }, [userId, role]);

  // Perform move
  const move = async () => {
    try {
      if (target.type === "file") {
        await axios.patch(`${BACKEND_URL}/files/${target.item._id}/move`, {
          newFolderId: dest || null,
          userId,
        });
      } else {
        await axios.patch(`${BACKEND_URL}/folders/${target.item._id}/move`, {
          newFolderId: dest || null,
          userId,
        });
      }
      if (onMoved) onMoved(currentFolder); // 🔑 refresh parent folder
      // Modal closes automatically after successful move
      onClose();
    } catch (err) {
      console.error("Error moving:", err);
      alert("Error moving item");
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Move {target.type}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <label className="form-label">Destination folder</label>
            <select
              className="form-select"
              value={dest || ""}
              onChange={(e) => setDest(e.target.value || null)}
            >
              <option value="">(Root)</option>
              {allFolders.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.path || ""}{f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={move}>Move</button>
          </div>
        </div>
      </div>
    </div>
  );
}
