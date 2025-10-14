import React, { useEffect, useMemo, useState } from "react";
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
} from "react-icons/fa";
import { BACKEND_URL } from "../config";


export default function Trash() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [view, setView] = useState("grid");

  // Fetch trash contents
  const fetchTrash = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/trash`, {
        params: { userId, role },
      });
      setFiles(res.data.files || []);
      setFolders(res.data.folders || []);
    } catch (err) {
      console.error("Failed to fetch trash:", err);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, [userId, role]);

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

  return (
    <div className="container-fluid py-3 file-manager-container">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h4 className="fw-bold text-danger mb-0">Trash</h4>
        <div className="btn-group">
          <button
            className={`btn ${
              view === "grid" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setView("grid")}
            title="Grid View"
          >
            <FaTh />
          </button>
          <button
            className={`btn ${
              view === "list" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setView("list")}
            title="List View"
          >
            <FaList />
          </button>
        </div>
      </div>

      {/* GRID VIEW */}
      {view === "grid" ? (
        <div className="row g-4">
          {/* Folders */}
          {folders.map((folder) => (
            <div key={folder._id} className="col-6 col-sm-4 col-md-3 col-xl-2">
              <div className="card folder-card h-100">
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
          ))}

          {/* Files */}
          {files.map((file) => (
            <div key={file._id} className="col-6 col-sm-4 col-md-3 col-xl-2">
              <div className="card file-card h-100">
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
          ))}
        </div>
      ) : (
        // LIST VIEW
        <div className="table-container">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Deleted At</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {folders.map((folder) => (
                <tr key={folder._id}>
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
              ))}
              {files.map((file) => (
                <tr key={file._id}>
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
              ))}
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
