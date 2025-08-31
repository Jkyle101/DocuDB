import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaFolder,
  FaFileAlt,
  FaShareAlt,
  FaTrash,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
  FaChevronRight,
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
  const [sharedFolders, setSharedFolders] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);

  useEffect(() => {
    const fetchShared = async () => {
      const res = await axios.get("http://localhost:5000/shared", {
        params: { userId, folderId: currentFolderId },
      });
      setSharedFolders(res.data.folders);
      setSharedFiles(res.data.files);
    };
    fetchShared();
  }, [currentFolderId]);

  useEffect(() => {
    fetchShared().catch(console.error);
  }, [userId]);

  // Open a folder (navigate deeper)
  const openFolder = (folder) => {
    setBreadcrumbs([...breadcrumbs, { id: folder._id, name: folder.name }]);
    fetchShared(folder._id);
  };

  // Go back via breadcrumb
  const goToBreadcrumb = (index) => {
    const crumb = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    fetchShared(crumb.id);
  };

  // File icons
  const iconByMime = useMemo(
    () => (mimetype) => {
      if (!mimetype) return <FaFileAlt size={36} className="text-secondary" />;
      if (mimetype.includes("pdf"))
        return <FaFilePdf size={36} className="text-danger" />;
      if (mimetype.includes("word") || mimetype.includes("doc"))
        return <FaFileWord size={36} className="text-primary" />;
      if (mimetype.includes("excel") || mimetype.includes("spreadsheet"))
        return <FaFileExcel size={36} className="text-success" />;
      if (mimetype.includes("image"))
        return <FaFileImage size={36} className="text-warning" />;
      if (mimetype.includes("zip") || mimetype.includes("rar"))
        return <FaFileArchive size={36} className="text-muted" />;
      if (mimetype.includes("video"))
        return <FaFileVideo size={36} className="text-info" />;
      return <FaFileAlt size={36} className="text-secondary" />;
    },
    []
  );

  return (
    <div className="container-fluid py-3">
      {/* Breadcrumbs */}
      <div className="d-flex align-items-center mb-3">
        {breadcrumbs.map((crumb, idx) => (
          <span
            key={idx}
            className={`fw-semibold ${
              idx === breadcrumbs.length - 1 ? "text-dark" : "text-primary"
            }`}
            style={{
              cursor: idx === breadcrumbs.length - 1 ? "default" : "pointer",
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

      {/* Folders */}
      <div className="row g-3 mb-3">
        {folders.map((folder) => (
          <div key={folder._id} className="col-6 col-sm-4 col-md-3 col-lg-2">
            <div
              className="card p-3 h-100 shadow-sm folder-card"
              style={{ cursor: "pointer" }}
              onClick={() => openFolder(folder)}
            >
              <div className="text-center">
                <FaFolder size={40} className="text-warning mb-2" />
                <div className="text-truncate fw-semibold">{folder.name}</div>
              </div>
              <div className="d-flex justify-content-center gap-2 mt-2 flex-wrap">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={(e) => {
                    e.stopPropagation(); // prevent folder open
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

      {/* Files */}
      <div className="row g-3">
        {files.map((file) => (
          <div key={file._id} className="col-6 col-sm-4 col-md-3 col-lg-2">
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
                  Open
                </a>
                <a
                  className="btn btn-sm btn-outline-success"
                  href={`${API}/download/${file.filename}`}
                >
                  Download
                </a>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShareTarget({ type: "file", item: file })}
                >
                  <FaShareAlt />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Share Modal */}
      {shareTarget && (
        <ShareModal onClose={() => setShareTarget(null)} target={shareTarget} />
      )}
    </div>
  );
}
