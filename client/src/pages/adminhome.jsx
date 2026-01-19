// src/pages/AdminHome.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaFolder,
  FaFileAlt,
  FaChevronRight,
  FaArrowLeft,
  FaTh,
  FaList,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
  FaCloudDownloadAlt,
  FaEye,
  FaTrash,
} from "react-icons/fa";

import { BACKEND_URL } from "../config";

export default function AdminHome() {
  const role = "admin"; // always admin
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [view, setView] = useState("grid");

  // ✅ Fetch folders + files + breadcrumbs
  const fetchFolderContents = useCallback(async (folderId) => {
    try {
      const params = { role, parentFolder: folderId || "" };

      const [fdrRes, filRes, bcRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/folders`, { params }),
        axios.get(`${BACKEND_URL}/files`, { params }),
        axios.get(`${BACKEND_URL}/breadcrumbs`, { params: { folderId } }),
      ]);

      setFolders(fdrRes.data);
      setFiles(filRes.data);
      setBreadcrumbs(bcRes.data);
    } catch (err) {
      console.error("Error fetching admin contents:", err);
    }
  }, [role]);

  useEffect(() => {
    fetchFolderContents(currentFolderId);
  }, [fetchFolderContents, currentFolderId]);

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

  // Navigation
  const goInto = (folderId) => setCurrentFolderId(folderId);
  const goUp = () => {
    if (!breadcrumbs.length) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    setCurrentFolderId(parent ? parent._id : null);
  };

  // Delete actions
  const deleteFolder = async (folder) => {
    if (!window.confirm(`Delete folder "${folder.name}" and its contents?`))
      return;
    await axios.delete(`${BACKEND_URL}/folders/${folder._id}`, { params: { role } });
    setFolders((s) => s.filter((f) => f._id !== folder._id));
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Always show all files/folders (no search in admin)
  const visibleFolders = folders;
  const visibleFiles = files;

  return (
    <div className="container-fluid py-3 file-manager-container">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        {/* Breadcrumbs */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {currentFolderId && (
            <button className="btn btn-outline-secondary" onClick={goUp}>
              <FaArrowLeft className="me-1" /> Back
            </button>
          )}
          <div className="d-flex align-items-center flex-wrap overflow-auto">
            <span className="fw-bold me-2 text-primary">Admin Drive</span>
            {breadcrumbs.length > 0 &&
              breadcrumbs.map((b) => (
                <span key={b._id || "root"} className="d-flex align-items-center">
                  <FaChevronRight className="mx-2 text-muted" size={12} />
                  <button
                    className="btn btn-link p-0 text-dark text-decoration-none"
                    onClick={() => setCurrentFolderId(b._id || null)}
                  >
                    {b.name || "Root"}
                  </button>
                </span>
              ))}
          </div>
        </div>

        {/* View Toggles */}
        <div className="d-flex align-items-center gap-2">
          <div className="btn-group" role="group">
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
      </div>

      {/* GRID VIEW */}
      {view === "grid" ? (
        <div className="row g-4">
          {/* Folders */}
          {visibleFolders.map((folder) => (
            <div
              key={folder._id}
              className="col-6 col-sm-4 col-md-3 col-xl-2"
              onDoubleClick={() => goInto(folder._id)}
            >
              <div className="card folder-card h-100 text-center p-3">
                <FaFolder size={42} className="text-warning mb-3" />
                <h6 className="card-title text-truncate">{folder.name}</h6>
                <p className="text-muted small">Owner: {folder.owner?.email}</p>
                
              </div>
            </div>
          ))}

          {/* Files */}
          {visibleFiles.map((file) => (
            <div key={file._id} className="col-6 col-sm-4 col-md-3 col-xl-2">
              <div className="card file-card h-100 text-center p-3">
                <div className="mb-3">{iconByMime(file.mimetype)}</div>
                <h6 className="card-title text-truncate">{file.originalName}</h6>
                <p className="text-muted small">Owner: {file.owner?.email}</p>
                <p className="text-muted small">{formatFileSize(file.size)}</p>
                <div className="btn-group w-100">
                  <a
                    className="btn btn-sm btn-outline-primary"
                    href={`${BACKEND_URL}/view/${file.filename}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FaEye />
                  </a>
                  <a
                    className="btn btn-sm btn-outline-success"
                    href={`${BACKEND_URL}/download/${file.filename}`}
                  >
                    <FaCloudDownloadAlt />
                  </a>
                  
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // LIST VIEW
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Size</th>
                <th>Modified</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleFolders.map((folder) => (
                <tr key={folder._id} onDoubleClick={() => goInto(folder._id)}>
                  <td className="d-flex align-items-center">
                    <FaFolder className="text-warning me-2" />
                    {folder.name}
                  </td>
                  <td>Folder</td>
                  <td>{folder.owner?.email}</td>
                  <td>—</td>
                  <td>{new Date(folder.createdAt).toLocaleDateString()}</td>
                  <td className="text-center">
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteFolder(folder)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleFiles.map((file) => (
                <tr key={file._id}>
                  <td className="d-flex align-items-center">
                    {iconByMime(file.mimetype)} {file.originalName}
                  </td>
                  <td>{file.mimetype.split("/")[1] || file.mimetype}</td>
                  <td>{file.owner?.email}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{new Date(file.uploadDate).toLocaleDateString()}</td>
                  <td className="text-center">
                    <div className="btn-group">
                      <a
                        className="btn btn-sm btn-outline-primary"
                        href={`${BACKEND_URL}/view/${file.filename}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FaEye />
                      </a>
                      <a
                        className="btn btn-sm btn-outline-success"
                        href={`${BACKEND_URL}/download/${file.filename}`}
                      >
                        <FaCloudDownloadAlt />
                      </a>
                      
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {visibleFolders.length === 0 && visibleFiles.length === 0 && (
        <div className="text-center py-5">
          <FaFolder className="text-muted mb-3" size={48} />
          <h5 className="text-muted">No files or folders found</h5>
        </div>
      )}
    </div>
  );
}
