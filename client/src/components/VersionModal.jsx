import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { FaHistory, FaUndo, FaUpload, FaFileUpload } from "react-icons/fa";

export default function VersionModal({ onClose, target, onRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [changeDescription, setChangeDescription] = useState("");

  const fileInputRef = useRef(null);

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const ownerId =
    target?.item?.owner?._id?.toString?.() ||
    target?.item?.owner?.toString?.() ||
    target?.item?.userId;
  const isOwner = ownerId && userId && ownerId.toString() === userId.toString();
  const canRestore = isOwner || role === "admin" || role === "superadmin";
  const restoreArmed = confirmText.trim().toUpperCase() === "RESTORE";

  const fetchVersions = useCallback(async () => {
    if (!target?.item?._id || !target?.type) return;
    try {
      setLoading(true);
      const endpoint = target.type === "file"
        ? `${BACKEND_URL}/files/${target.item._id}/versions`
        : `${BACKEND_URL}/folders/${target.item._id}/versions`;
      
      const res = await axios.get(endpoint);
      setVersions(res.data);
    } catch (err) {
      console.error("Failed to fetch versions:", err);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    fetchVersions();
    setConfirmText("");
  }, [fetchVersions]);

  const handleRestore = async (version) => {
    if (!restoreArmed) return;
    if (!window.confirm(`Restore to version ${version.versionNumber}? This will create a new version.`)) return;

    try {
      setRestoring(version._id);
      const endpoint = target.type === "file"
        ? `${BACKEND_URL}/files/${target.item._id}/versions/${version._id}/restore`
        : `${BACKEND_URL}/folders/${target.item._id}/versions/${version._id}/restore`;

      await axios.post(endpoint, { userId });
      alert("Version restored successfully!");
      if (onRestored) onRestored();
      fetchVersions();
    } catch (err) {
      console.error("Failed to restore version:", err);
      alert("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files[0]) {
      alert("Please select a file to upload");
      return;
    }

    if (!changeDescription.trim()) {
      alert("Please provide a description for this version");
      return;
    }

    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);
    formData.append("fileId", target.item._id);
    formData.append("isUpdate", "true");
    formData.append("changeDescription", changeDescription.trim());

    try {
      setUploading(true);
      const res = await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert("New version uploaded successfully!");
      setChangeDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (onRestored) onRestored();
      fetchVersions();
    } catch (err) {
      console.error("Failed to upload new version:", err);
      alert("Failed to upload new version");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <FaHistory className="me-2" />
              Version History - {target.item.originalName || target.item.name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {/* Upload New Version Section */}
            {target.type === "file" && isOwner && (
              <div className="card mb-4 border-primary">
                <div className="card-header bg-primary text-white">
                  <FaUpload className="me-2" />
                  Upload New Version
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Select New File Version</label>
                    <input
                      type="file"
                      className="form-control"
                      ref={fileInputRef}
                      disabled={uploading}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Change Description</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Describe what changed in this version"
                      value={changeDescription}
                      onChange={(e) => setChangeDescription(e.target.value)}
                      disabled={uploading}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={uploading || !changeDescription.trim()}
                  >
                    <FaFileUpload className="me-2" />
                    {uploading ? "Uploading..." : "Upload New Version"}
                  </button>
                </div>
              </div>
            )}

            {!canRestore && (
              <div className="alert alert-warning">
                Only the owner can restore versions.
              </div>
            )}
            <div className="mb-3">
              <label className="form-label mb-1">Secondary security</label>
              <input
                className="form-control"
                placeholder='Type "RESTORE" to enable restore'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <div className="form-text">
                This prevents accidental undo/redo. Clear the field to disable.
              </div>
            </div>
            {loading ? (
              <p>Loading versions...</p>
            ) : versions.length === 0 ? (
              <p className="text-muted">No version history available.</p>
            ) : (
              <div className="list-group">
                {versions.map((version) => (
                  <div
                    key={version._id}
                    className={`list-group-item ${version.isCurrent ? "bg-light" : ""}`}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <span className="badge bg-primary">Version {version.versionNumber}</span>
                          {version.isCurrent && (
                            <span className="badge bg-success">Current</span>
                          )}
                        </div>
                        <p className="mb-1">
                          <strong>Changed by:</strong> {version.createdBy?.email || "Unknown"}
                        </p>
                        <p className="mb-1">
                          <strong>Date:</strong> {new Date(version.createdAt).toLocaleString()}
                        </p>
                        {version.changeDescription && (
                          <p className="mb-0 text-muted">
                            <strong>Description:</strong> {version.changeDescription}
                          </p>
                        )}
                        {target.type === "file" && (
                          <p className="mb-0 text-muted small">
                            Size: {(version.size / 1024).toFixed(2)} KB
                          </p>
                        )}
                      </div>
                      {!version.isCurrent && (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleRestore(version)}
                          disabled={!canRestore || !restoreArmed || restoring === version._id}
                        >
                          <FaUndo className="me-1" />
                          {restoring === version._id ? "Restoring..." : "Restore"}
                        </button>
                      )}
                    </div>
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
