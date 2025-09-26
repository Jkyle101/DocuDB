import React, { useEffect, useMemo, useState } from "react";
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
} from "react-icons/fa";

import ShareModal from "../components/ShareModal";
import "../pages/home.css";

const API = "http://localhost:3001";

export default function Shared() {
  const userId = localStorage.getItem("userId");

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [shareTarget, setShareTarget] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [view, setView] = useState("grid");

  // Breadcrumbs
  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: null, name: "Shared with Me" },
  ]);
  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  // Fetch shared items
  const fetchShared = async (folderId = null) => {
    try {
      const res = await axios.get(`${API}/shared`, {
        params: { userId, folderId },
      });
      setFolders(res.data.folders || []);
      setFiles(res.data.files || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchShared(currentFolderId).catch(console.error);
  }, [userId, currentFolderId]);

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

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        {/* Breadcrumbs */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {breadcrumbs.map((crumb, idx) => (
            <span
              key={idx}
              className={`fw-semibold ${
                idx === breadcrumbs.length - 1 ? "text-dark" : "text-primary"
              }`}
              style={{
                cursor:
                  idx === breadcrumbs.length - 1 ? "default" : "pointer",
              }}
              onClick={() =>
                idx !== breadcrumbs.length - 1 && goToBreadcrumb(idx)
              }
            >
              {crumb.name}
              {idx < breadcrumbs.length - 1 && (
                <FaChevronRight className="mx-2 text-muted" />
              )}
            </span>
          ))}
        </div>

        {/* View Toggles */}
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

      {/* Stats */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card stats-card">
            <div className="card-body py-2">
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {folders.length} folder{folders.length !== 1 ? "s" : ""},{" "}
                  {files.length} file{files.length !== 1 ? "s" : ""}
                </span>
                <span className="text-muted">
                  Last updated: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {folders.length === 0 && files.length === 0 ? (
        <div className="text-center py-5 empty-state">
          <FaFolder className="text-muted mb-3" size={48} />
          <h5 className="text-muted">No shared files yet</h5>
          <p className="text-muted">
            Files and folders shared with you will appear here.
          </p>
        </div>
      ) : view === "grid" ? (
        <>
          {/* Grid View */}
          <div className="row g-3 mb-3">
            {folders.map((folder) => (
              <div
                key={folder._id}
                className="col-6 col-sm-4 col-md-3 col-lg-2"
              >
                <div
                  className="card p-3 h-100 shadow-sm folder-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => openFolder(folder)}
                >
                  <div className="text-center">
                    <FaFolder size={40} className="text-warning mb-2" />
                    <div className="text-truncate fw-semibold">
                      {folder.name}
                    </div>
                  </div>
                  <div className="d-flex justify-content-center gap-2 mt-2 flex-wrap">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareTarget({ type: "folder", item: folder });
                      }}
                    >
                      <FaShareAlt />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-3">
            {files.map((file) => (
              <div
                key={file._id}
                className="col-6 col-sm-4 col-md-3 col-lg-2"
              >
                <div className="card p-3 h-100 text-center shadow-sm">
                  <div className="mb-2">{iconByMime(file.mimetype)}</div>
                  <div className="text-truncate fw-semibold">
                    {file.originalName}
                  </div>
                  <div className="d-flex justify-content-center gap-1 mt-2 flex-nowrap">
                    <a
                      className="btn btn-sm btn-outline-primary"
                      href={`${API}/view/${file.filename}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FaEye />
                    </a>
                    <a
                      className="btn btn-sm btn-outline-success"
                      href={`${API}/download/${file.filename}`}
                    >
                      <FaCloudDownloadAlt />
                    </a>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() =>
                        setShareTarget({ type: "file", item: file })
                      }
                    >
                      <FaShareAlt />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* List View */
        <div className="table-container">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th width="40%">Name</th>
                <th width="20%">Type</th>
                <th width="20%">Owner</th>
                <th width="20%" className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {folders.map((folder) => (
                <tr key={folder._id}>
                  <td
                    role="button"
                    onClick={() => openFolder(folder)}
                    className="d-flex align-items-center"
                  >
                    <FaFolder className="text-warning me-2" />
                    <span className="text-truncate">{folder.name}</span>
                  </td>
                  <td>Folder</td>
                  <td>{folder.ownerEmail || "—"}</td>
                  <td className="text-center">
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() =>
                        setShareTarget({ type: "folder", item: folder })
                      }
                      title="Share"
                    >
                      <FaShareAlt />
                    </button>
                  </td>
                </tr>
              ))}
              {files.map((file) => (
                <tr key={file._id}>
                  <td className="d-flex align-items-center">
                    <span className="me-2">{iconByMime(file.mimetype)}</span>
                    <span className="text-truncate">
                      {file.originalName}
                    </span>
                  </td>
                  <td>{file.mimetype.split("/")[1]}</td>
                  <td>{file.ownerEmail || "—"}</td>
                  <td className="text-center">
                    <a
                      className="btn btn-sm btn-outline-primary me-2"
                      href={`${API}/view/${file.filename}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FaEye />
                    </a>
                    <a
                      className="btn btn-sm btn-outline-success me-2"
                      href={`${API}/download/${file.filename}`}
                    >
                      <FaCloudDownloadAlt />
                    </a>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() =>
                        setShareTarget({ type: "file", item: file })
                      }
                    >
                      <FaShareAlt />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Share Modal */}
      {shareTarget && (
        <ShareModal
          onClose={() => setShareTarget(null)}
          target={shareTarget}
        />
      )}
    </div>
  );
}
