import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FaTimes } from "react-icons/fa";
import { BACKEND_URL } from "../config";

export default function ManageSharesModal({ onClose, target, onUpdated }) {
  const [sharedWith, setSharedWith] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSharedUsers = useCallback(async () => {
    if (!target?.item?._id || !target?.type) return;
    try {
      setLoading(true);
      const endpoint = target.type === "file" 
        ? `${BACKEND_URL}/files/${target.item._id}`
        : `${BACKEND_URL}/folders/${target.item._id}`;
      
      const res = await axios.get(endpoint);
      const item = res.data;
      
      // sharedWith is already populated with email from backend
      if (item.sharedWith && item.sharedWith.length > 0) {
        setSharedWith(item.sharedWith.map(sw => ({
          _id: typeof sw === 'object' && sw._id ? sw._id : sw,
          email: typeof sw === 'object' && sw.email ? sw.email : sw
        })));
      } else {
        setSharedWith([]);
      }
    } catch (err) {
      console.error("Failed to fetch shared users:", err);
      setSharedWith([]);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    fetchSharedUsers();
  }, [fetchSharedUsers]);

  const handleUnshare = async (userId) => {
    if (!window.confirm(`Remove this user's access to this ${target.type}?`)) return;
    
    try {
      const endpoint = target.type === "file"
        ? `${BACKEND_URL}/files/${target.item._id}/unshare`
        : `${BACKEND_URL}/folders/${target.item._id}/unshare`;
      
      await axios.patch(endpoint, { userId });
      setSharedWith(prev => prev.filter(user => user._id.toString() !== userId.toString()));
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error("Failed to unshare:", err);
      alert("Failed to remove user access");
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Manage Shares - {target.item.originalName || target.item.name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <p>Loading...</p>
            ) : sharedWith.length === 0 ? (
              <p className="text-muted">This {target.type} is not shared with anyone.</p>
            ) : (
              <div className="list-group">
                {sharedWith.map((user) => (
                  <div key={user._id} className="list-group-item d-flex justify-content-between align-items-center">
                    <span>{user.email}</span>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleUnshare(user._id)}
                      title="Remove access"
                    >
                      <FaTimes /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
