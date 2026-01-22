import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaTh,
  FaList,
  FaFolder,
  FaFileAlt,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
  FaCloudDownloadAlt,
  FaEye,
  FaTrashRestore,
  FaTimes,
  FaCheckSquare,
  FaSquare,
  FaTrash,
  FaExclamationTriangle
} from "react-icons/fa";
import { BACKEND_URL } from "../config";


export default function Trash() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [view, setView] = useState("grid");
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Fetch trash contents
  const fetchTrash = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/trash`, {
        params: { userId, role },
      });
      setFiles(res.data.files || []);
      setFolders(res.data.folders || []);
    } catch (err) {
      console.error("Failed to fetch trash:", err);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  // File icons
  const iconByMime = useMemo(
    () => (mimetype) => {
      if (!mimetype) return <FaFileAlt className="file-icon text-secondary" />;
      if (mimetype.includes("pdf"))
        return <FaFilePdf className="file-icon text-danger" />;
      if (mimetype.includes("word") || mimetype.includes("doc"))
        return <FaFileWord className="file-icon text-primary" />;
      if (mimetype.includes("excel") || mimetype.includes("spreadsheet"))
        return <FaFileExcel className="file-icon text-success" />;
      if (mimetype.includes("image"))
        return <FaFileImage className="file-icon text-warning" />;
      if (mimetype.includes("zip") || mimetype.includes("rar"))
        return <FaFileArchive className="file-icon text-muted" />;
      if (mimetype.includes("video"))
        return <FaFileVideo className="file-icon text-info" />;
      return <FaFileAlt className="file-icon text-secondary" />;
    },
    []
  );

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Restore file/folder
  const restoreItem = async (type, id) => {
    try {
      await axios.patch(`${BACKEND_URL}/trash/${type}/${id}/restore`);
      fetchTrash();
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  };

  // Permanent delete file/folder
  const deleteItem = async (type, id) => {
    if (!window.confirm("This will permanently delete the item. Continue?"))
      return;
    try {
      await axios.delete(`${BACKEND_URL}/trash/${type}/${id}`);
      fetchTrash();
    } catch (err) {
      console.error("Failed to permanently delete:", err);
    }
  };

  // Selection handlers
  const toggleItemSelection = (type, id) => {
    const itemKey = `${type}-${id}`;
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    const allItems = new Set();
    folders.forEach(folder => allItems.add(`folder-${folder._id}`));
    files.forEach(file => allItems.add(`file-${file._id}`));
    setSelectedItems(allItems);
  };

  const selectNoneItems = () => {
    setSelectedItems(new Set());
  };

  // Bulk operations
  const bulkRestore = async () => {
    if (selectedItems.size === 0) return;

    const confirmMessage = `Restore ${selectedItems.size} selected item(s)?`;
    if (!window.confirm(confirmMessage)) return;

    const promises = [];
    selectedItems.forEach(itemKey => {
      const [type, id] = itemKey.split('-');
      const endpoint = type === 'folder' ? 'folders' : 'files';
      promises.push(axios.patch(`${BACKEND_URL}/trash/${endpoint}/${id}/restore`));
    });

    try {
      await Promise.all(promises);
      setSelectedItems(new Set());
      fetchTrash();
      alert(`Successfully restored ${selectedItems.size} item(s)`);
    } catch (err) {
      console.error("Bulk restore failed:", err);
      alert("Some items could not be restored");
    }
  };

  const bulkDelete = async () => {
    if (selectedItems.size === 0) return;

    const confirmMessage = `Permanently delete ${selectedItems.size} selected item(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    const promises = [];
    selectedItems.forEach(itemKey => {
      const [type, id] = itemKey.split('-');
      const endpoint = type === 'folder' ? 'folders' : 'files';
      promises.push(axios.delete(`${BACKEND_URL}/trash/${endpoint}/${id}`));
    });

    try {
      await Promise.all(promises);
      setSelectedItems(new Set());
      fetchTrash();
      alert(`Successfully deleted ${selectedItems.size} item(s)`);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      alert("Some items could not be deleted");
    }
  };

  // Check if all items are selected
  const allItemsSelected = useMemo(() => {
    const totalItems = folders.length + files.length;
    return selectedItems.size === totalItems && totalItems > 0;
  }, [selectedItems, folders, files]);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h4 className="mb-1">
              <FaTrash className="me-2" />
              Trash
            </h4>
            <p className="subtitle mb-0">Deleted files and folders (30-day retention)</p>
          </div>

          {/* View Toggles */}
          <div className="view-toggles">
            <button
              className={`btn ${view === "grid" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setView("grid")}
              title="Grid View"
            >
              <FaTh />
            </button>
            <button
              className={`btn ${view === "list" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setView("list")}
              title="List View"
            >
              <FaList />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-section">
        <div className="stats-row">
          <div className="stat-card">
            <div className="icon danger">
              <FaTrash />
            </div>
            <h4>{folders.length + files.length}</h4>
            <p>Items in Trash</p>
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {(folders.length > 0 || files.length > 0) && (
        <div className="unified-tabs">
          <div className="tab-content">
            <div className="d-flex justify-content-between align-items-center py-3">
              <div className="d-flex align-items-center gap-3">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={allItemsSelected ? selectNoneItems : selectAllItems}
                  title={allItemsSelected ? "Select None" : "Select All"}
                >
                  {allItemsSelected ? <FaCheckSquare className="me-1" /> : <FaSquare className="me-1" />}
                  {allItemsSelected ? "Select None" : "Select All"}
                </button>
                {selectedItems.size > 0 && (
                  <span className="text-muted small">
                    {selectedItems.size} item(s) selected
                  </span>
                )}
              </div>
              <div className="action-buttons">
                {selectedItems.size > 0 && (
                  <>
                    <button
                      className="btn btn-success"
                      onClick={bulkRestore}
                      title="Restore Selected Items"
                    >
                      <FaTrashRestore className="me-1" />
                      Restore ({selectedItems.size})
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={bulkDelete}
                      title="Permanently Delete Selected Items"
                    >
                      <FaTrash className="me-1" />
                      Delete All ({selectedItems.size})
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {view === "grid" ? (
        <div className="row g-4">
          {/* Folders */}
          {folders.map((folder) => {
            const isSelected = selectedItems.has(`folder-${folder._id}`);
            return (
              <div key={folder._id} className="col-6 col-sm-4 col-md-3 col-xl-2">
                <div className={`card folder-card h-100 ${isSelected ? 'border-primary' : ''}`}>
                  <div className="card-header d-flex align-items-center justify-content-between bg-light">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={isSelected}
                      onChange={() => toggleItemSelection('folder', folder._id)}
                    />
                    {isSelected && <FaCheckSquare className="text-primary" />}
                  </div>
                  <div className="card-body text-center">
                    <FaFolder size={42} className="text-warning mb-3" />
                    <h6 className="card-title text-truncate">{folder.name}</h6>
                    <p className="text-muted small">Folder</p>
                    <div className="btn-group w-100">
                      <button
                        className="btn btn-sm btn-outline-success"
                        onClick={() => restoreItem("folders", folder._id)}
                      >
                        <FaTrashRestore /> Restore
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteItem("folders", folder._id)}
                      >
                        <FaTimes /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Files */}
          {files.map((file) => {
            const isSelected = selectedItems.has(`file-${file._id}`);
            return (
              <div key={file._id} className="col-6 col-sm-4 col-md-3 col-xl-2">
                <div className={`card file-card h-100 ${isSelected ? 'border-primary' : ''}`}>
                  <div className="card-header d-flex align-items-center justify-content-between bg-light">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={isSelected}
                      onChange={() => toggleItemSelection('file', file._id)}
                    />
                    {isSelected && <FaCheckSquare className="text-primary" />}
                  </div>
                  <div className="card-body text-center">
                    <div className="mb-3">{iconByMime(file.mimetype)}</div>
                    <h6 className="card-title text-truncate">{file.originalName}</h6>
                    <p className="text-muted small">{formatFileSize(file.size)}</p>
                    <div className="btn-group w-100">
                      <button
                        className="btn btn-sm btn-outline-success"
                        onClick={() => restoreItem("files", file._id)}
                      >
                        <FaTrashRestore /> Restore
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteItem("files", file._id)}
                      >
                        <FaTimes /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // LIST VIEW
        <div className="table-container">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th style={{width: '50px'}}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allItemsSelected}
                    onChange={allItemsSelected ? selectNoneItems : selectAllItems}
                    title={allItemsSelected ? "Select None" : "Select All"}
                  />
                </th>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Deleted At</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {folders.map((folder) => {
                const isSelected = selectedItems.has(`folder-${folder._id}`);
                return (
                  <tr key={folder._id} className={isSelected ? 'table-active' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={isSelected}
                        onChange={() => toggleItemSelection('folder', folder._id)}
                      />
                    </td>
                    <td>
                      <FaFolder className="text-warning me-2" />
                      {folder.name}
                    </td>
                    <td>Folder</td>
                    <td>—</td>
                    <td>{new Date(folder.deletedAt).toLocaleDateString()}</td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-outline-success me-2"
                        onClick={() => restoreItem("folders", folder._id)}
                      >
                        <FaTrashRestore /> Restore
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteItem("folders", folder._id)}
                      >
                        <FaTimes /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {files.map((file) => {
                const isSelected = selectedItems.has(`file-${file._id}`);
                return (
                  <tr key={file._id} className={isSelected ? 'table-active' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={isSelected}
                        onChange={() => toggleItemSelection('file', file._id)}
                      />
                    </td>
                    <td>
                      {iconByMime(file.mimetype)} {file.originalName}
                    </td>
                    <td>{file.mimetype.split("/")[1]}</td>
                    <td>{formatFileSize(file.size)}</td>
                    <td>{new Date(file.deletedAt).toLocaleDateString()}</td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-outline-success me-2"
                        onClick={() => restoreItem("files", file._id)}
                      >
                        <FaTrashRestore /> Restore
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteItem("files", file._id)}
                      >
                        <FaTimes /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && folders.length === 0 && (
        <div className="text-center py-5 empty-state">
          <FaTrashRestore className="text-muted mb-3" size={48} />
          <h5 className="text-muted">Trash is empty</h5>
          <p className="text-muted">
            Deleted items will appear here for 30 days before permanent removal.
          </p>
        </div>
      )}
    </div>
  );
}
