import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaTh,
  FaList,
  FaFileAlt,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
  FaCloudDownloadAlt,
  FaEye,
  FaEllipsisV,
  FaArrowsAlt,
  FaShareAlt,
  FaComment,
  FaHistory,
  FaTrash,
} from "react-icons/fa";

import { BACKEND_URL } from "../config";
import MoveModal from "../components/MoveModal";
import ShareModal from "../components/ShareModal";
import VersionModal from "../components/VersionModal";
import CommentsModal from "../components/CommentsModal";



export default function Recent() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";
  
  const [files, setFiles] = useState([]);
  const [view, setView] = useState("grid");
  const [moveTarget, setMoveTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [versionTarget, setVersionTarget] = useState(null);
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });

  const [limit, setLimit] = useState(20);

  // Fetch recent files - only files uploaded by the current user
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        // Pass userId to filter files by the current user
        // Backend will automatically filter by userId for non-admin users
        const res = await axios.get(`${BACKEND_URL}/files`, {
          params: { userId, role },
        });
        setFiles(res.data);
      } catch (err) {
        console.error("Failed to fetch recent files:", err);
      }
    };
    if (userId) {
      fetchRecent();
    }
  }, [userId, role]);

  // File icons
  const iconByMime = useMemo(
    () => (mimetype) => {
      if (!mimetype) return <FaFileAlt className="file-icon text-secondary" />;
      if (mimetype.includes("pdf")) return <FaFilePdf className="file-icon text-danger" />;
      if (mimetype.includes("word") || mimetype.includes("doc")) return <FaFileWord className="file-icon text-primary" />;
      if (mimetype.includes("excel") || mimetype.includes("spreadsheet")) return <FaFileExcel className="file-icon text-success" />;
      if (mimetype.includes("image")) return <FaFileImage className="file-icon text-warning" />;
      if (mimetype.includes("zip") || mimetype.includes("rar")) return <FaFileArchive className="file-icon text-muted" />;
      if (mimetype.includes("video")) return <FaFileVideo className="file-icon text-info" />;
      return <FaFileAlt className="file-icon text-secondary" />;
    },
    []
  );

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const visibleFiles = files.slice(0, limit);

  // Delete file
  const deleteFile = async (file) => {
    if (!window.confirm(`Delete file "${file.originalName}"?`)) return;
    await axios.delete(`${BACKEND_URL}/files/${file._id}`, { params: { userId, role } });
    setFiles((s) => s.filter((f) => f._id !== file._id));
  };

  // Context menu
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setSelectedItem(item);
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      item,
    });
  };

  const handleClick = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [handleClick]);

  return (
    
    <div className="container-fluid py-3 file-manager-container">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h4 className="fw-bold text-primary mb-0">Recent Files</h4>

        {/* View */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="btn-group" role="group">
            <button className={`btn ${view === "grid" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("grid")}>
              <FaTh />
            </button>
            <button className={`btn ${view === "list" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("list")}>
              <FaList />
            </button>
          </div>
        </div>
      </div>
    {/* Stats Bar */}
    <div className="row mb-4">
          <div className="col-12">
            <div className="card stats-card">
              <div className="card-body py-2">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">
                    {files.length} file{files.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-muted">
                    Last updated: {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* GRID VIEW */}
      {view === "grid" ? (
        <div className="row g-4">
          {visibleFiles.map((file) => (
            <div
              key={file._id}
              className="col-6 col-sm-4 col-md-3 col-xl-2"
              onContextMenu={(e) => handleContextMenu(e, { type: "file", data: file })}
              onClick={() => setSelectedItem({ type: "file", data: file })}
            >
              <div className={`card file-card h-100 ${selectedItem?.data?._id === file._id ? "selected" : ""}`}>
                <div className="card-body text-center">
                  <div className="position-absolute top-0 end-0 p-2">
                    <button
                      className="btn btn-sm btn-light"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          visible: true,
                          x: e.pageX,
                          y: e.pageY,
                          item: { type: "file", data: file },
                        });
                      }}
                    >
                      <FaEllipsisV />
                    </button>
                  </div>
                  <div className="mb-3">{iconByMime(file.mimetype)}</div>
                  <h6 className="card-title text-truncate">{file.originalName}</h6>
                  <p className="text-muted small">{formatFileSize(file.size)}</p>
                  <p className="text-muted small">
                    {file.owner?._id?.toString() === userId || file.owner?.toString() === userId
                      ? "You own the file"
                      : `Owner: ${file.owner?.email || "—"}`}
                  </p>
                  <div className="btn-group btn-group-sm">
                    <a
                      className="btn btn-outline-secondary"
                      href={`${BACKEND_URL}/view/${file.filename}?userId=${userId}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Preview"
                    >
                      <FaEye />
                    </a>
                    <a
                      className="btn btn-outline-secondary"
                      href={`${BACKEND_URL}/download/${file.filename}?userId=${userId}`}
                      onClick={(e) => e.stopPropagation()}
                      title="Download"
                    >
                      <FaCloudDownloadAlt />
                    </a>
                    <button
                      className="btn btn-outline-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCommentsTarget({ type: "file", item: file });
                      }}
                      title="Comments"
                    >
                      <FaComment />
                    </button>
                  </div>
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
                <th width="35%">Name</th>
                <th width="12%">Type</th>
                <th width="12%">Size</th>
                <th width="16%">Modified</th>
                <th width="15%">Owner</th>
                <th width="10%" className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleFiles.map((file) => (
                <tr
                  key={file._id}
                  onContextMenu={(e) => handleContextMenu(e, { type: "file", data: file })}
                  onClick={() => setSelectedItem({ type: "file", data: file })}
                  className={selectedItem?.data?._id === file._id ? "table-active" : ""}
                >
                  <td className="d-flex align-items-center">
                    <span className="me-2">{iconByMime(file.mimetype)}</span>
                    <span className="text-truncate">{file.originalName}</span>
                  </td>
                  <td>{file.mimetype.split("/")[1] || file.mimetype}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{new Date(file.uploadDate).toLocaleDateString()}</td>
                  <td>
                    {file.owner?._id?.toString() === userId || file.owner?.toString() === userId
                      ? "You own the file"
                      : file.owner?.email || "—"}
                  </td>
                  <td className="text-center">
                    <div className="btn-group btn-group-sm">
                      <a
                        className="btn btn-outline-secondary"
                        href={`${BACKEND_URL}/view/${file.filename}?userId=${userId}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Preview"
                      >
                        <FaEye />
                      </a>
                      <a
                        className="btn btn-outline-secondary"
                        href={`${BACKEND_URL}/download/${file.filename}?userId=${userId}`}
                        onClick={(e) => e.stopPropagation()}
                        title="Download"
                      >
                        <FaCloudDownloadAlt />
                      </a>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCommentsTarget({ type: "file", item: file });
                        }}
                        title="Comments"
                      >
                        <FaComment />
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu({
                            visible: true,
                            x: e.pageX,
                            y: e.pageY,
                            item: { type: "file", data: file },
                          });
                        }}
                        title="More"
                      >
                        <FaEllipsisV />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load More */}
      {files.length > limit && (
        <div className="text-center mt-4">
          <button className="btn btn-outline-primary" onClick={() => setLimit((prev) => prev + 20)}>
            Load More
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.item?.type === "file" && (
        <div
          className="context-menu show"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-header">
            <FaFileAlt className="text-primary me-2" /> {contextMenu.item.data.originalName}
          </div>
          <div className="context-menu-divider"></div>
          <a className="context-menu-item" href={`${BACKEND_URL}/view/${contextMenu.item.data.filename}?userId=${userId}`} target="_blank" rel="noreferrer">
            <FaEye className="me-2" /> Preview
          </a>
          <a className="context-menu-item" href={`${BACKEND_URL}/download/${contextMenu.item.data.filename}?userId=${userId}`}>
            <FaCloudDownloadAlt className="me-2" /> Download
          </a>
          <button className="context-menu-item" onClick={() => setMoveTarget({ type: "file", item: contextMenu.item.data })}>
            <FaArrowsAlt className="me-2" /> Move
          </button>
          <button className="context-menu-item" onClick={() => setShareTarget({ type: "file", item: contextMenu.item.data })}>
            <FaShareAlt className="me-2" /> Share
          </button>
          <button
            className="context-menu-item"
            onClick={() => setVersionTarget({ type: "file", item: contextMenu.item.data })}
          >
            <FaHistory className="me-2" /> Version History
          </button>
          <button
            className="context-menu-item"
            onClick={() => setCommentsTarget({ type: "file", item: contextMenu.item.data })}
          >
            <FaComment className="me-2" /> Comments
          </button>
          <div className="context-menu-divider"></div>
          <button className="context-menu-item text-danger" onClick={() => deleteFile(contextMenu.item.data)}>
            <FaTrash className="me-2" /> Delete
          </button>
        </div>
      )}

      {/* Empty State */}
      {visibleFiles.length === 0 && (
        <div className="text-center py-5 empty-state">
          <FaFileAlt className="text-muted mb-3" size={48} />
          <h5 className="text-muted">No recent files</h5>
          <p className="text-muted">Uploaded files will appear here</p>
        </div>
      )}

      {/* Modals */}
      {moveTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <MoveModal
            onClose={() => setMoveTarget(null)}
            target={moveTarget}
            currentFolder={null}
            onMoved={() => setMoveTarget(null)}
          />
        </>
      )}
      {shareTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <ShareModal onClose={() => setShareTarget(null)} target={shareTarget} />
        </>
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
    </div>
  );
}
