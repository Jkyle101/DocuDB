import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaFolder,
  FaFileAlt,
  FaShareAlt,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
  FaChevronRight,
  FaTh,
  FaList,
  FaEye,
  FaCloudDownloadAlt,
  FaHistory,
  FaComment,
  FaUsers,
  FaTrash,
  FaEdit,
  FaDownload,
} from "react-icons/fa";

import ShareModal from "../components/ShareModal";
import VersionModal from "../components/VersionModal";
import CommentsModal from "../components/CommentsModal";
import RenameModal from "../components/RenameModal";
import "../pages/home.css";
import { BACKEND_URL } from "../config";

export default function Shared() {
  const userId = localStorage.getItem("userId");

  // Active tab state
  const [activeTab, setActiveTab] = useState("personal");

  // Personal shares state
  const [personalFolders, setPersonalFolders] = useState([]);
  const [personalFiles, setPersonalFiles] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [personalLoading, setPersonalLoading] = useState(false);

  // Group shares state
  const [groupFolders, setGroupFolders] = useState([]);
  const [groupFiles, setGroupFiles] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);

  // Modals
  const [shareTarget, setShareTarget] = useState(null);
  const [versionTarget, setVersionTarget] = useState(null);
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [view, setView] = useState("grid");

  // Breadcrumbs
  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: null, name: "Shared with Me" },
  ]);

  // Fetch personal shared items
  const fetchPersonalShared = useCallback(async (folderId = null) => {
    try {
      setPersonalLoading(true);
      const res = await axios.get(`${BACKEND_URL}/shared`, {
        params: { userId, folderId },
      });
      setPersonalFolders(res.data.folders || []);
      setPersonalFiles(res.data.files || []);
    } catch (err) {
      console.error("Failed to fetch personal shared items:", err);
    } finally {
      setPersonalLoading(false);
    }
  }, [userId]);

  // Fetch group shared items
  const fetchGroupShared = useCallback(async () => {
    try {
      setGroupLoading(true);
      const res = await axios.get(`${BACKEND_URL}/shared/groups`, {
        params: { userId },
      });
      setGroupFolders(res.data.folders || []);
      setGroupFiles(res.data.files || []);
    } catch (err) {
      console.error("Failed to fetch group shared items:", err);
    } finally {
      setGroupLoading(false);
    }
  }, [userId]);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === "personal") {
      fetchPersonalShared(currentFolderId).catch(console.error);
    } else if (activeTab === "groups") {
      fetchGroupShared();
    }
  }, [activeTab, fetchPersonalShared, fetchGroupShared, currentFolderId]);

  // Open a folder (navigate deeper)
  const openFolder = (folder) => {
    setBreadcrumbs([...breadcrumbs, { id: folder._id, name: folder.name }]);
    setCurrentFolderId(folder._id);
  };

  // Go back via breadcrumb
  const goToBreadcrumb = (index) => {
    const crumb = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentFolderId(crumb.id);
  };

  // File icons
  const iconByMime = useMemo(
    () => (mimetype) => {
      if (!mimetype) return <FaFileAlt size={28} className="text-secondary" />;
      if (mimetype.includes("pdf"))
        return <FaFilePdf size={28} className="text-danger" />;
      if (mimetype.includes("word") || mimetype.includes("doc"))
        return <FaFileWord size={28} className="text-primary" />;
      if (mimetype.includes("excel") || mimetype.includes("spreadsheet"))
        return <FaFileExcel size={28} className="text-success" />;
      if (mimetype.includes("image"))
        return <FaFileImage size={28} className="text-warning" />;
      if (mimetype.includes("zip") || mimetype.includes("rar"))
        return <FaFileArchive size={28} className="text-muted" />;
      if (mimetype.includes("video"))
        return <FaFileVideo size={28} className="text-info" />;
      return <FaFileAlt size={28} className="text-secondary" />;
    },
    []
  );

  // Current data based on active tab
  const currentFolders = activeTab === "personal" ? personalFolders : groupFolders;
  const currentFiles = activeTab === "personal" ? personalFiles : groupFiles;
  const isLoading = activeTab === "personal" ? personalLoading : groupLoading;

  // Check if user owns an item (for group shares)
  const isOwner = (item) => {
    return item.owner && item.owner.toString() === userId;
  };

  // Check if user has write permission
  const hasWritePermission = (item) => {
    if (activeTab === "personal") {
      return item.permissions === "write";
    } else {
      // For group shares, owners always have write permission
      return isOwner(item) || item.permission === "write";
    }
  };

  // Handle file deletion (for owners in group shares)
  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Delete "${file.originalName}"?`)) return;

    try {
      await axios.delete(`${BACKEND_URL}/files/${file._id}`);
      fetchGroupShared(); // Refresh group shares
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert("Failed to delete file");
    }
  };

  // Handle folder deletion (for owners in group shares)
  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(`Delete "${folder.name}"?`)) return;

    try {
      await axios.delete(`${BACKEND_URL}/folders/${folder._id}`);
      fetchGroupShared(); // Refresh group shares
    } catch (err) {
      console.error("Failed to delete folder:", err);
      alert("Failed to delete folder");
    }
  };

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h4 className="mb-0">Shared with Me</h4>

        {/* View Toggles */}
        <div className="d-flex align-items-center gap-2">
          <div className="btn-group">
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

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "personal" ? "active" : ""}`}
            onClick={() => setActiveTab("personal")}
          >
            <FaShareAlt className="me-2" />
            Personal Shares
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "groups" ? "active" : ""}`}
            onClick={() => setActiveTab("groups")}
          >
            <FaUsers className="me-2" />
            Group Shares
          </button>
        </li>
      </ul>

      {/* Stats */}
      <div className="row mb-4">
        <div className="col-md-6 mb-3">
          <div className="card stats-card h-100">
            <div className="card-body text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <FaFolder className="text-warning me-2" size={24} />
                <h4 className="mb-0">{currentFolders.length}</h4>
              </div>
              <p className="text-muted mb-0">Folders</p>
            </div>
          </div>
        </div>
        <div className="col-md-6 mb-3">
          <div className="card stats-card h-100">
            <div className="card-body text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <FaFileAlt className="text-primary me-2" size={24} />
                <h4 className="mb-0">{currentFiles.length}</h4>
              </div>
              <p className="text-muted mb-0">Files</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading shared items...</p>
        </div>
      ) : currentFolders.length === 0 && currentFiles.length === 0 ? (
        <div className="text-center py-5 empty-state">
          <FaFolder className="text-muted mb-3" size={48} />
          <h5 className="text-muted">
            {activeTab === "personal" ? "No personal shares yet" : "No group shares yet"}
          </h5>
          <p className="text-muted">
            {activeTab === "personal"
              ? "Files and folders shared with you will appear here."
              : "Files and folders shared with your groups will appear here."
            }
          </p>
        </div>
      ) : view === "grid" ? (
        <>
          {/* Grid View - Folders */}
          <div className="row g-3 mb-4">
            {currentFolders.map((folder) => (
              <div
                key={folder._id}
                className="col-6 col-sm-4 col-md-3 col-lg-2"
              >
                <div className="card h-100 shadow-sm hover-card">
                  <div className="card-body text-center p-3">
                    <FaFolder size={48} className="text-warning mb-3" />
                    <h6 className="card-title text-truncate mb-2" title={folder.name}>
                      {folder.name}
                    </h6>
                    {activeTab === "groups" && (
                      <div className="small text-muted mb-3">
                        <FaUsers className="me-1" />
                        {folder.groupName}
                      </div>
                    )}

                    {/* Action Buttons - Primary Actions */}
                    <div className="d-flex justify-content-center gap-1 mb-2">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setCommentsTarget({ type: "folder", item: folder })}
                        title="Comments"
                      >
                        <FaComment />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-info"
                        onClick={() => setVersionTarget({ type: "folder", item: folder })}
                        title="Version History"
                      >
                        <FaHistory />
                      </button>
                    </div>

                    {/* Owner Actions - Secondary Row */}
                    {hasWritePermission(folder) && activeTab === "groups" && isOwner(folder) && (
                      <div className="d-flex justify-content-center gap-1">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setRenameTarget({ type: "folder", item: folder })}
                          title="Rename"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteFolder(folder)}
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Grid View - Files */}
          <div className="row g-3">
            {currentFiles.map((file) => (
              <div
                key={file._id}
                className="col-6 col-sm-4 col-md-3 col-lg-2"
              >
                <div className="card h-100 shadow-sm hover-card">
                  <div className="card-body text-center p-3">
                    <div className="mb-3">{iconByMime(file.mimetype)}</div>
                    <h6 className="card-title text-truncate mb-2" title={file.originalName}>
                      {file.originalName}
                    </h6>
                    {activeTab === "groups" && (
                      <div className="small text-muted mb-3">
                        <FaUsers className="me-1" />
                        {file.groupName}
                      </div>
                    )}

                    {/* Primary Actions */}
                    <div className="d-flex justify-content-center gap-1 mb-2">
                      <a
                        className="btn btn-sm btn-outline-primary"
                        href={`${BACKEND_URL}/preview/${file.filename}?userId=${userId}&role=${localStorage.getItem("role") || "user"}`}
                        target="_blank"
                        rel="noreferrer"
                        title="View"
                      >
                        <FaEye />
                      </a>
                      {hasWritePermission(file) && (
                        <a
                          className="btn btn-sm btn-outline-success"
                          href={`${BACKEND_URL}/download/${file.filename}?userId=${userId}`}
                          title="Download"
                        >
                          <FaDownload />
                        </a>
                      )}
                      <button
                        className="btn btn-sm btn-outline-info"
                        onClick={() => setCommentsTarget({ type: "file", item: file })}
                        title="Comments"
                      >
                        <FaComment />
                      </button>
                    </div>

                    {/* Secondary Actions Row */}
                    <div className="d-flex justify-content-center gap-1">
                      {activeTab === "groups" && isOwner(file) && (
                        <>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setRenameTarget({ type: "file", item: file })}
                            title="Rename"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteFile(file)}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </>
                      )}
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setVersionTarget({ type: "file", item: file })}
                        title="Version History"
                      >
                        <FaHistory />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* List View */
        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="border-0 fw-semibold ps-4 py-3">Name</th>
                    <th className="border-0 fw-semibold py-3">Type</th>
                    <th className="border-0 fw-semibold py-3">Owner</th>
                    {activeTab === "groups" && <th className="border-0 fw-semibold py-3">Group</th>}
                    <th className="border-0 fw-semibold py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFolders.map((folder) => (
                    <tr key={folder._id} className="border-bottom border-light">
                      <td className="ps-4 py-3">
                        <div className="d-flex align-items-center">
                          <FaFolder className="text-warning me-3 fs-5" />
                          <div>
                            <div className="fw-semibold text-truncate" style={{maxWidth: "200px"}} title={folder.name}>
                              {folder.name}
                            </div>
                            {activeTab === "groups" && (
                              <small className="text-muted">
                                <FaUsers className="me-1" />
                                {folder.groupName}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="badge bg-light text-dark">Folder</span>
                      </td>
                      <td className="py-3 text-muted">{folder.ownerEmail || "—"}</td>
                      {activeTab === "groups" && (
                        <td className="py-3">
                          <span className="badge bg-info">
                            <FaUsers className="me-1" />
                            {folder.groupName}
                          </span>
                        </td>
                      )}
                      <td className="py-3 text-center">
                        <div className="d-flex justify-content-center gap-1 flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => setCommentsTarget({ type: "folder", item: folder })}
                            title="Comments"
                          >
                            <FaComment />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-info"
                            onClick={() => setVersionTarget({ type: "folder", item: folder })}
                            title="Version History"
                          >
                            <FaHistory />
                          </button>
                          {hasWritePermission(folder) && activeTab === "groups" && isOwner(folder) && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setRenameTarget({ type: "folder", item: folder })}
                                title="Rename"
                              >
                                <FaEdit />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteFolder(folder)}
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {currentFiles.map((file) => (
                    <tr key={file._id} className="border-bottom border-light">
                      <td className="ps-4 py-3">
                        <div className="d-flex align-items-center">
                          <span className="me-3 fs-5">{iconByMime(file.mimetype)}</span>
                          <div>
                            <div className="fw-semibold text-truncate" style={{maxWidth: "200px"}} title={file.originalName}>
                              {file.originalName}
                            </div>
                            {activeTab === "groups" && (
                              <small className="text-muted">
                                <FaUsers className="me-1" />
                                {file.groupName}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="badge bg-light text-dark">
                          {file.mimetype?.split("/")[1]?.toUpperCase() || "FILE"}
                        </span>
                      </td>
                      <td className="py-3 text-muted">{file.ownerEmail || "—"}</td>
                      {activeTab === "groups" && (
                        <td className="py-3">
                          <span className="badge bg-info">
                            <FaUsers className="me-1" />
                            {file.groupName}
                          </span>
                        </td>
                      )}
                      <td className="py-3 text-center">
                        <div className="d-flex justify-content-center gap-1 flex-wrap">
                          <a
                            className="btn btn-sm btn-outline-primary"
                            href={`${BACKEND_URL}/preview/${file.filename}?userId=${userId}&role=${localStorage.getItem("role") || "user"}`}
                            target="_blank"
                            rel="noreferrer"
                            title="View"
                          >
                            <FaEye />
                          </a>
                          {hasWritePermission(file) && (
                            <a
                              className="btn btn-sm btn-outline-success"
                              href={`${BACKEND_URL}/download/${file.filename}?userId=${userId}`}
                              title="Download"
                            >
                              <FaDownload />
                            </a>
                          )}
                          <button
                            className="btn btn-sm btn-outline-info"
                            onClick={() => setCommentsTarget({ type: "file", item: file })}
                            title="Comments"
                          >
                            <FaComment />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setVersionTarget({ type: "file", item: file })}
                            title="Version History"
                          >
                            <FaHistory />
                          </button>
                          {activeTab === "groups" && isOwner(file) && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setRenameTarget({ type: "file", item: file })}
                                title="Rename"
                              >
                                <FaEdit />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteFile(file)}
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {shareTarget && (
        <ShareModal
          onClose={() => setShareTarget(null)}
          target={shareTarget}
        />
      )}
      {versionTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <VersionModal onClose={() => setVersionTarget(null)} target={versionTarget} />
        </>
      )}
      {commentsTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <CommentsModal onClose={() => setCommentsTarget(null)} target={commentsTarget} />
        </>
      )}
      {renameTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <RenameModal
            onClose={() => setRenameTarget(null)}
            target={renameTarget}
            onRenamed={() => {
              if (activeTab === "groups") {
                fetchGroupShared();
              }
            }}
          />
        </>
      )}
    </div>
  );
}
