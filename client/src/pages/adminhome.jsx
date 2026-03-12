// src/pages/AdminHome.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
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
import { isExternalFileDrag, uploadDroppedEntries } from "../utils/dropUpload";

export default function AdminHome() {
  const role = localStorage.getItem("role") || "superadmin"; // admin or superadmin
  const userId = localStorage.getItem("userId");
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [view, setView] = useState("grid");
  const [dragPayload, setDragPayload] = useState(null);
  const [activeDropFolderId, setActiveDropFolderId] = useState("");
  const [movingByDrop, setMovingByDrop] = useState(false);
  const [externalDropActive, setExternalDropActive] = useState(false);
  const [uploadingDroppedItems, setUploadingDroppedItems] = useState(false);
  const [dropUploadMessage, setDropUploadMessage] = useState("");

  // Get search results from navbar
  const { searchResults } = useOutletContext();

  // âœ… Fetch folders + files + breadcrumbs
  const fetchFolderContents = useCallback(async (folderId) => {
    try {
      const params = { role, parentFolder: folderId || "" };

      const [fdrRes, filRes, bcRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/folders`, { params }),
        axios.get(`${BACKEND_URL}/files`, { params }),
        axios.get(`${BACKEND_URL}/breadcrumbs`, { params: { folderId } }),
      ]);

      setFolders(Array.isArray(fdrRes.data) ? fdrRes.data : []);
      setFiles(Array.isArray(filRes.data) ? filRes.data : []);
      setBreadcrumbs(Array.isArray(bcRes.data) ? bcRes.data : []);
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

  // âœ… Use search results if available, otherwise show all files/folders
  // Search results from admin search include files, folders, users, groups, logs
  // Filter only files and folders for display
  const searchFiles = searchResults?.filter(item => item.type === 'file') || [];
  const searchFolders = searchResults?.filter(item => item.type === 'folder') || [];
  const isSearchMode = Array.isArray(searchResults);
  
  const visibleFolders = searchResults ? searchFolders : folders;
  const visibleFiles = searchResults ? searchFiles : files;

  // Show search indicator when searching
  const isSearching = searchResults && searchResults.length > 0;

  const canDragItem = () => !isSearchMode;

  const moveDraggedItem = async (payload, destinationFolderId) => {
    if (!payload?.id || !destinationFolderId) return;
    if (String(payload.fromFolderId || "") === String(destinationFolderId)) return;

    const endpoint = payload.type === "file"
      ? `${BACKEND_URL}/files/${payload.id}/move`
      : `${BACKEND_URL}/folders/${payload.id}/move`;

    await axios.patch(endpoint, {
      newFolderId: destinationFolderId,
      userId,
      role,
    });

    await fetchFolderContents(currentFolderId);
  };

  const handleDragStart = (event, payload) => {
    if (!payload || !canDragItem()) return;
    setDragPayload(payload);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${payload.type}:${payload.id}`);
  };

  const handleDragEnd = () => {
    setDragPayload(null);
    setActiveDropFolderId("");
  };

  const handleFolderDragOver = (event, folderId) => {
    if (isExternalFileDrag(event)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      setActiveDropFolderId(String(folderId));
      return;
    }
    if (!dragPayload || !folderId) return;
    if (dragPayload.type === "folder" && String(dragPayload.id) === String(folderId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveDropFolderId(String(folderId));
  };

  const uploadFromDropDataTransfer = async (dataTransfer, destinationFolderId = currentFolderId || null) => {
    if (isSearchMode) {
      alert("Exit search mode before dropping files or folders.");
      return false;
    }
    setUploadingDroppedItems(true);
    setDropUploadMessage("Preparing dropped files...");
    try {
      const result = await uploadDroppedEntries({
        dataTransfer,
        destinationFolderId,
        userId,
        role,
        onStatus: setDropUploadMessage,
      });
      await fetchFolderContents(currentFolderId);
      setDropUploadMessage(
        `Uploaded ${result.uploadedCount} file${result.uploadedCount === 1 ? "" : "s"} by drag and drop.`
      );
      return true;
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || "Drag-and-drop upload failed");
      setDropUploadMessage("");
      return false;
    } finally {
      setUploadingDroppedItems(false);
      setExternalDropActive(false);
    }
  };

  const handleFolderDrop = async (event, folderId) => {
    event.preventDefault();
    if (isExternalFileDrag(event)) {
      event.stopPropagation();
      setActiveDropFolderId("");
      await uploadFromDropDataTransfer(event.dataTransfer, folderId);
      return;
    }
    if (!dragPayload || !folderId) return;
    if (dragPayload.type === "folder" && String(dragPayload.id) === String(folderId)) {
      setActiveDropFolderId("");
      return;
    }
    setMovingByDrop(true);
    try {
      await moveDraggedItem(dragPayload, folderId);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to move item");
    } finally {
      setMovingByDrop(false);
      setDragPayload(null);
      setActiveDropFolderId("");
    }
  };

  const handleWorkspaceDragEnter = (event) => {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    setExternalDropActive(true);
  };

  const handleWorkspaceDragOver = (event) => {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setExternalDropActive(true);
  };

  const handleWorkspaceDragLeave = (event) => {
    if (!isExternalFileDrag(event)) return;
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setExternalDropActive(false);
  };

  const handleWorkspaceDrop = async (event) => {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    await uploadFromDropDataTransfer(event.dataTransfer, currentFolderId || null);
  };

  useEffect(() => {
    if (!dropUploadMessage || uploadingDroppedItems) return;
    const timer = setTimeout(() => setDropUploadMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [dropUploadMessage, uploadingDroppedItems]);

  return (
    <div
      className="container-fluid py-3 file-manager-container"
      onDragEnter={handleWorkspaceDragEnter}
      onDragOver={handleWorkspaceDragOver}
      onDragLeave={handleWorkspaceDragLeave}
      onDrop={handleWorkspaceDrop}
    >
      {(externalDropActive || uploadingDroppedItems || dropUploadMessage) && (
        <div className={`alert py-2 mb-3 ${externalDropActive ? "alert-primary" : "alert-info"}`}>
          {uploadingDroppedItems
            ? dropUploadMessage || "Uploading dropped files..."
            : externalDropActive
              ? "Drop files or folders to upload into this location."
              : dropUploadMessage}
        </div>
      )}
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        {/* Breadcrumbs */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {currentFolderId && (
            <button className="btn btn-outline-secondary" onClick={goUp}>
              <FaArrowLeft className="me-1" /> Back
            </button>
          )}
          {/* Search indicator */}
          {isSearching && (
            <span className="badge bg-info me-2">
              Search Results ({searchResults.length})
              <button 
                className="btn-close btn-close-white ms-2" 
                style={{ fontSize: '10px' }}
                onClick={() => {
                  // Clear search by refreshing the page or navigating
                  window.location.reload();
                }}
                title="Clear search"
              />
            </span>
          )}
          <div className="d-flex align-items-center flex-wrap overflow-auto">
            <span className="fw-bold me-2 text-primary">Admin Drive</span>
            {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 &&
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
          {movingByDrop && (
            <div className="col-12">
              <div className="alert alert-info py-2 mb-0">Moving item...</div>
            </div>
          )}
          {/* Folders */}
          {visibleFolders.map((folder) => (
            <div
              key={folder._id}
              className="col-6 col-sm-4 col-md-3 col-xl-2"
              draggable={canDragItem()}
              onDragStart={(e) => handleDragStart(e, {
                type: "folder",
                id: folder._id,
                fromFolderId: currentFolderId || "",
              })}
              onDragEnd={handleDragEnd}
              onDoubleClick={() => goInto(folder._id)}
            >
              <div
                className="card folder-card h-100 text-center p-3"
                onDragOver={(e) => handleFolderDragOver(e, folder._id)}
                onDrop={(e) => handleFolderDrop(e, folder._id)}
                onDragLeave={() => {
                  if (activeDropFolderId === String(folder._id)) setActiveDropFolderId("");
                }}
                style={activeDropFolderId === String(folder._id)
                  ? { border: "2px dashed #0d6efd", background: "rgba(13,110,253,0.08)" }
                  : undefined}
              >
                <FaFolder size={42} className="text-warning mb-3" />
                <h6 className="card-title text-truncate">{folder.name}</h6>
                {folder.isPredefinedRoot && (
                  <div className="mb-1">
                    <span className="badge bg-primary">Predefined Folder Tree</span>
                  </div>
                )}
                <p className="text-muted small">Owner: {folder.owner?.email}</p>
                
              </div>
            </div>
          ))}

          {/* Files */}
          {visibleFiles.map((file) => (
            <div
              key={file._id}
              className="col-6 col-sm-4 col-md-3 col-xl-2"
              draggable={canDragItem()}
              onDragStart={(e) => handleDragStart(e, {
                type: "file",
                id: file._id,
                fromFolderId: currentFolderId || "",
              })}
              onDragEnd={handleDragEnd}
            >
              <div className="card file-card h-100 text-center p-3">
                <div className="mb-3">{iconByMime(file.mimetype)}</div>
                <h6 className="card-title text-truncate">{file.originalName}</h6>
                <p className="text-muted small">Owner: {file.owner?.email}</p>
                <p className="text-muted small">{formatFileSize(file.size)}</p>
                <div className="btn-group w-100">
                  <a
                    className="btn btn-sm btn-outline-primary"
                    href={`${BACKEND_URL}/preview/${file.filename}?role=${role}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FaEye />
                  </a>
                  <a
                    className="btn btn-sm btn-outline-success"
                    href={`${BACKEND_URL}/download/${file.filename}?role=${role}`}
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
                <tr
                  key={folder._id}
                  draggable={canDragItem()}
                  onDragStart={(e) => handleDragStart(e, {
                    type: "folder",
                    id: folder._id,
                    fromFolderId: currentFolderId || "",
                  })}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleFolderDragOver(e, folder._id)}
                  onDrop={(e) => handleFolderDrop(e, folder._id)}
                  onDragLeave={() => {
                    if (activeDropFolderId === String(folder._id)) setActiveDropFolderId("");
                  }}
                  onDoubleClick={() => goInto(folder._id)}
                  style={activeDropFolderId === String(folder._id) ? { outline: "2px dashed #0d6efd", outlineOffset: "-2px" } : undefined}
                >
                  <td className="d-flex align-items-center">
                    <FaFolder className="text-warning me-2" />
                    {folder.name}
                    {folder.isPredefinedRoot && (
                      <span className="badge bg-primary ms-2">Predefined Folder Tree</span>
                    )}
                  </td>
                  <td>Folder</td>
                  <td>{folder.owner?.email}</td>
                  <td>â€”</td>
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
                <tr
                  key={file._id}
                  draggable={canDragItem()}
                  onDragStart={(e) => handleDragStart(e, {
                    type: "file",
                    id: file._id,
                    fromFolderId: currentFolderId || "",
                  })}
                  onDragEnd={handleDragEnd}
                >
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
                        href={`${BACKEND_URL}/preview/${file.filename}?role=${role}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FaEye />
                      </a>
                      <a
                        className="btn btn-sm btn-outline-success"
                        href={`${BACKEND_URL}/download/${file.filename}?role=${role}`}
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

