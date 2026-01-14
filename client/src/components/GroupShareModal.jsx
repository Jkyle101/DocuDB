import React, { useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

export default function GroupShareModal({ onClose, group, onShared }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [permission, setPermission] = useState("read");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const userId = localStorage.getItem("userId");

  useEffect(() => {
    const fetchUserFiles = async () => {
      try {
        setLoading(true);
        const [filesRes, foldersRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/files?userId=${userId}`),
          axios.get(`${BACKEND_URL}/folders/all?userId=${userId}`)
        ]);

        // Filter out items already shared with this group
        const sharedFileIds = group.sharedFiles?.map(sf => sf.fileId?._id || sf.fileId) || [];
        const sharedFolderIds = group.sharedFolders?.map(sf => sf.folderId?._id || sf.folderId) || [];

        const availableFiles = filesRes.data.filter(file =>
          !sharedFileIds.includes(file._id)
        );
        const availableFolders = foldersRes.data.filter(folder =>
          !sharedFolderIds.includes(folder._id)
        );

        setFiles(availableFiles);
        setFolders(availableFolders);
      } catch (err) {
        console.error("Failed to fetch user files/folders:", err);
      } finally {
        setLoading(false);
      }
    };

    if (group && userId) {
      fetchUserFiles();
    }
  }, [group, userId]);

  const toggleItemSelection = (item, type) => {
    const itemId = item._id;

    setSelectedItems(prev => {
      const exists = prev.some(selected => selected.id === itemId && selected.type === type);
      if (exists) {
        return prev.filter(selected => !(selected.id === itemId && selected.type === type));
      } else {
        return [...prev, { id: itemId, type, name: item.originalName || item.name }];
      }
    });
  };

  const isItemSelected = (itemId, type) => {
    return selectedItems.some(selected => selected.id === itemId && selected.type === type);
  };

  const handleShare = async () => {
    if (selectedItems.length === 0) return;

    try {
      setSharing(true);
      const sharePromises = selectedItems.map(item =>
        axios.patch(`${BACKEND_URL}/groups/${group._id}/share`, {
          type: item.type,
          itemId: item.id,
          permission,
          sharedBy: userId
        })
      );

      await Promise.all(sharePromises);

      if (onShared) {
        onShared();
      }
      onClose();
    } catch (err) {
      console.error("Failed to share items:", err);
      const errorMessage = err.response?.data?.error || "Failed to share items. Please try again.";
      alert(errorMessage);
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="modal d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Share with {group?.name}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading your files and folders...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Share with {group?.name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">Permission Level</label>
              <select
                className="form-select"
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
              >
                <option value="read">Read Only</option>
                <option value="write">Read & Write</option>
              </select>
            </div>

            <div className="row">
              <div className="col-md-6">
                <h6>Files</h6>
                {files.length === 0 ? (
                  <p className="text-muted small">No files available to share</p>
                ) : (
                  <div className="list-group" style={{ maxHeight: "300px", overflowY: "auto" }}>
                    {files.map((file) => (
                      <div key={file._id} className="list-group-item list-group-item-action">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={isItemSelected(file._id, "file")}
                            onChange={() => toggleItemSelection(file, "file")}
                            id={`file-${file._id}`}
                          />
                          <label className="form-check-label" htmlFor={`file-${file._id}`}>
                            <div>
                              <strong>{file.originalName}</strong>
                              <br />
                              <small className="text-muted">
                                {new Date(file.uploadDate).toLocaleDateString()} • {(file.size / 1024).toFixed(1)} KB
                              </small>
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <h6>Folders</h6>
                {folders.length === 0 ? (
                  <p className="text-muted small">No folders available to share</p>
                ) : (
                  <div className="list-group" style={{ maxHeight: "300px", overflowY: "auto" }}>
                    {folders.map((folder) => (
                      <div key={folder._id} className="list-group-item list-group-item-action">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={isItemSelected(folder._id, "folder")}
                            onChange={() => toggleItemSelection(folder, "folder")}
                            id={`folder-${folder._id}`}
                          />
                          <label className="form-check-label" htmlFor={`folder-${folder._id}`}>
                            <div>
                              <strong>{folder.name}</strong>
                              <br />
                              <small className="text-muted">
                                {new Date(folder.createdAt).toLocaleDateString()}
                              </small>
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-3">
                <h6>Selected Items ({selectedItems.length})</h6>
                <div className="small">
                  {selectedItems.map((item) => (
                    <span key={`${item.type}-${item.id}`} className="badge bg-primary me-1 mb-1">
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={sharing}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleShare}
              disabled={selectedItems.length === 0 || sharing}
            >
              {sharing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Sharing...
                </>
              ) : (
                `Share ${selectedItems.length} Item${selectedItems.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
