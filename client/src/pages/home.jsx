import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaFolder,
  FaFileAlt,
  FaChevronRight,
  FaPlus,
  FaUpload,
  FaTrash,
  FaArrowLeft,
  FaShareAlt,
  FaArrowsAlt,
  FaTh,
  FaList,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
  FaEllipsisV,
  FaCloudDownloadAlt,
  FaEye,
  FaHistory,
  FaComment,
  FaUsers,
  FaStar,
  FaRegStar,
  FaThumbtack,
  FaEdit,
} from "react-icons/fa";

import { FaFileSignature } from "react-icons/fa"; // ✅ new icon for Rename
import RenameModal from "../components/RenameModal.jsx"; // ✅ new modal component

import CreateFolderModal from "../components/CreateFolderModal.jsx";
import MoveModal from "../components/MoveModal";
import ShareModal from "../components/ShareModal";
import ManageSharesModal from "../components/ManageSharesModal";
import UploadModal from "../components/UploadModal";
import VersionModal from "../components/VersionModal.jsx";
import CommentsModal from "../components/CommentsModal.jsx";
import { useOutletContext, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";

export default function Home() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [renameTarget, setRenameTarget] = useState(null); // ✅ for rename modal

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);

  const [view, setView] = useState("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [manageSharesTarget, setManageSharesTarget] = useState(null);
  const [versionTarget, setVersionTarget] = useState(null);
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    item: null,
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const { searchResults } = useOutletContext();
  const navigate = useNavigate();

  // ✅ Pagination state
  const [itemsToShow, setItemsToShow] = useState(12);

  // Reset pagination when folder or search changes
  useEffect(() => {
    setItemsToShow(12);
  }, [currentFolder, searchResults]);

  // Fetch folders + files + breadcrumbs
  const fetchFolderContents = useCallback(async (folderId) => {
    const params = {
      userId,
      role,
      parentFolder: folderId || "",
    };
    const [fdrRes, filRes, bcRes] = await Promise.all([
      axios.get(`${BACKEND_URL}/folders`, { params }),
      axios.get(`${BACKEND_URL}/files`, { params }),
      axios.get(`${BACKEND_URL}/breadcrumbs`, { params: { folderId } }),
    ]);
    setFolders(fdrRes.data);
    setFiles(filRes.data);
    setBreadcrumbs(bcRes.data);
  }, [userId, role]);

  useEffect(() => {
    fetchFolderContents(currentFolder).catch(console.error);
  }, [fetchFolderContents, currentFolder]);

  useEffect(() => {
    axios.post(`${BACKEND_URL}/notifications/smart/${userId}`).catch(() => {});
  }, [userId]);

  // File icons
  const iconByMime = useMemo(
    () => (mimetype) => {
      if (!mimetype) return <FaFileAlt className="file-icon text-secondary" />;
      if (mimetype.includes("pdf"))
        return <FaFilePdf className="file-icon text-danger" />;
      if (
        mimetype.includes("docx") ||
        mimetype.includes(
          "vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      )
        return <FaFileWord className="file-icon text-primary" />;
      if (
        mimetype.includes("xlsx") ||
        mimetype.includes(
          "vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      )
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

  const goInto = (folderId) => setCurrentFolder(folderId);
  const goUp = () => {
    if (!breadcrumbs.length) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    setCurrentFolder(parent ? parent._id : null);
  };

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Delete folder "${folder.name}" and its contents?`))
      return;
    await axios.delete(`${BACKEND_URL}/folders/${folder._id}`, {
      params: { userId, role },
    });
    setFolders((s) => s.filter((f) => f._id !== folder._id));
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Delete file "${file.originalName}"?`)) return;
    await axios.delete(`${BACKEND_URL}/files/${file._id}`, {
      params: { userId, role },
    });
    setFiles((s) => s.filter((f) => f._id !== file._id));
  };

  const patchFileFlags = useCallback((fileId, changes) => {
    setFiles((prev) =>
      prev.map((f) => (f._id === fileId ? { ...f, ...changes } : f))
    );
    setSelectedItem((prev) => {
      if (prev?.type === "file" && prev?.data?._id === fileId) {
        return { ...prev, data: { ...prev.data, ...changes } };
      }
      return prev;
    });
    setContextMenu((prev) => {
      if (prev?.item?.type === "file" && prev?.item?.data?._id === fileId) {
        return {
          ...prev,
          item: { ...prev.item, data: { ...prev.item.data, ...changes } },
        };
      }
      return prev;
    });
  }, []);

  const toggleFavorite = async (file) => {
    const next = !file.isFavorite;
    patchFileFlags(file._id, { isFavorite: next });
    try {
      await axios.patch(`${BACKEND_URL}/files/${file._id}/favorite`, {
        userId,
        role,
        favorited: next,
      });
    } catch (err) {
      patchFileFlags(file._id, { isFavorite: !next });
      console.error("Failed to update favorite:", err);
      alert("Failed to update favorite");
    }
  };

  const togglePinned = async (file) => {
    const next = !file.isPinned;
    patchFileFlags(file._id, { isPinned: next });
    try {
      await axios.patch(`${BACKEND_URL}/files/${file._id}/pin`, {
        userId,
        role,
        pinned: next,
      });
    } catch (err) {
      patchFileFlags(file._id, { isPinned: !next });
      console.error("Failed to update pin:", err);
      alert("Failed to update pin");
    }
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setSelectedItem(item);
    setContextMenu({
      visible: true,
      item: item,
    });
  };

  const handleClick = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [handleClick]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isEditableFile = (file) => {
    const name = (file?.originalName || "").toLowerCase();
    const editableExt = [".txt", ".md", ".json", ".xml", ".csv", ".docx", ".xlsx", ".xls", ".pdf", ".pptx", ".ppt"];
    return (
      file?.mimetype?.startsWith("text/") ||
      file?.mimetype === "application/json" ||
      file?.mimetype === "application/xml" ||
      editableExt.some((ext) => name.endsWith(ext))
    );
  };

  const trackAccess = async (file, action = "OPEN") => {
    if (!file?._id) return;
    try {
      await axios.post(`${BACKEND_URL}/files/${file._id}/access`, {
        userId,
        role,
        action,
      });
    } catch (err) {
      console.error("Track access failed:", err);
    }
  };

  // ✅ Use search results if available, otherwise normal data
  const searchFiles = useMemo(
    () =>
      (searchResults || []).filter((item) => {
        const kind = item?.type || (item?.originalName ? "file" : "folder");
        return kind === "file";
      }),
    [searchResults]
  );

  const searchFolders = useMemo(
    () =>
      (searchResults || []).filter((item) => {
        const kind = item?.type || (item?.originalName ? "file" : "folder");
        return kind === "folder";
      }),
    [searchResults]
  );

  const visibleFiles = useMemo(() => {
    const base = searchResults ? searchFiles : files;
    let filtered = base;
    if (showPinnedOnly) filtered = filtered.filter((f) => !!f.isPinned);
    if (showFavoritesOnly) filtered = filtered.filter((f) => !!f.isFavorite);
    return [...filtered].sort((a, b) => {
      const pinnedDelta = Number(!!b.isPinned) - Number(!!a.isPinned);
      if (pinnedDelta !== 0) return pinnedDelta;
      return new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0);
    });
  }, [searchResults, searchFiles, files, showFavoritesOnly, showPinnedOnly]);
  const visibleFolders = searchResults ? searchFolders : folders;

  // ✅ Paginated arrays
  const paginatedFolders = visibleFolders.slice(0, itemsToShow);
  const paginatedFiles = visibleFiles.slice(0, itemsToShow);

  const handleLoadMore = () => {
    setItemsToShow((prev) => prev + 15);
  };

  return (
    <>
      <div className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div className="flex-grow-1">
              <h4 className="mb-1">My Drive</h4>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {currentFolder && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={goUp}>
                    <FaArrowLeft className="me-1" /> Back
                  </button>
                )}
                <div className="d-flex align-items-center flex-wrap overflow-auto">
                  <span className="fw-semibold text-primary me-2">Home</span>
                  {breadcrumbs.length > 0 &&
                    breadcrumbs.map((b) => (
                      <span
                        key={b._id || "root"}
                        className="d-flex align-items-center"
                      >
                        <FaChevronRight className="mx-2 text-muted" size={12} />
                        <button
                          className="btn btn-link p-0 text-dark text-decoration-none fw-semibold"
                          onClick={() => setCurrentFolder(b._id || null)}
                        >
                          {b.name || "Root"}
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            </div>

            {/* View Toggles + Actions */}
            <div className="action-buttons">
              <div className="view-toggles me-3">
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
              <button
                className={`btn me-2 ${showFavoritesOnly ? "btn-warning" : "btn-outline-warning"}`}
                onClick={() => setShowFavoritesOnly((v) => !v)}
                title="Favorites"
              >
                <FaStar className="me-1" />
                Favorites
              </button>
              <button
                className={`btn me-2 ${showPinnedOnly ? "btn-dark" : "btn-outline-dark"}`}
                onClick={() => setShowPinnedOnly((v) => !v)}
                title="Pinned Documents"
              >
                <FaThumbtack className="me-1" />
                Pinned
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreate(true)}
              >
                <FaPlus className="me-1" /> New Folder
              </button>
              <button
                className="btn btn-success"
                onClick={() => setShowUpload(true)}
              >
                <FaUpload className="me-1" /> Upload
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="stats-section">
          <div className="stats-row">
            <div className="stat-card">
              <div className="icon primary">
                <FaFolder />
              </div>
              <h4>{folders.length}</h4>
              <p>Folders</p>
            </div>
            <div className="stat-card">
              <div className="icon success">
                <FaFileAlt />
              </div>
              <h4>{files.length}</h4>
              <p>Files</p>
            </div>
          </div>
        </div>

        {/* ✅ Grid & List Views (use paginated arrays) */}
        {view === "grid" ? (
          <div className="row g-3 documents-spotlight-grid">
            {/* Folders */}
            {paginatedFolders.map((folder) => (
              <div
                key={folder._id}
                className="col-6 col-sm-4 col-md-3 col-xl-2"
                onContextMenu={(e) =>
                  handleContextMenu(e, { type: "folder", data: folder })
                }
                onClick={() =>
                  setSelectedItem({ type: "folder", data: folder })
                }
              >
                <div
                  className={`card folder-card h-100 ${
                    selectedItem?.data?._id === folder._id ? "selected" : ""
                  }`}
                >
                  <div
                    className="card-body text-center"
                    role="button"
                    onDoubleClick={() => goInto(folder._id)}
                  >
                    <div className="position-absolute top-0 end-0 p-2">
                      <button
                        className="btn btn-sm btn-light"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, { type: "folder", data: folder });
                        }}
                      >
                        <FaEllipsisV />
                      </button>
                    </div>
                    <FaFolder
                      size={42}
                      className="text-warning mb-3 folder-icon"
                    />
                    <h6 className="card-title text-truncate">{folder.name}</h6>
                    <p className="text-muted small mb-1">Folder</p>
                    {folder.isShared && folder.ownerEmail && (
                      <p className="text-info small mb-0">
                        <FaUsers className="me-1" />
                        Shared by {folder.ownerEmail}
                      </p>
                    )}
                    <div className="btn-group btn-group-sm mt-2">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          goInto(folder._id);
                        }}
                        title="Open"
                      >
                        <FaEye />
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVersionTarget({ type: "folder", item: folder });
                        }}
                        title="Version History"
                      >
                        <FaHistory />
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCommentsTarget({ type: "folder", item: folder });
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

            {/* Files */}
            {paginatedFiles.map((file) => (
              <div
                key={file._id}
                className="col-6 col-sm-4 col-md-3 col-xl-2"
                onContextMenu={(e) =>
                  handleContextMenu(e, { type: "file", data: file })
                }
                onClick={() => setSelectedItem({ type: "file", data: file })}
              >
                <div
                  className={`card file-card h-100 ${
                    selectedItem?.data?._id === file._id ? "selected" : ""
                  }`}
                >
                  <div className="card-body text-center">
                    <div className="position-absolute top-0 end-0 p-2">
                      <button
                        className="btn btn-sm btn-light"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, { type: "file", data: file });
                        }}
                      >
                        <FaEllipsisV />
                      </button>
                    </div>
                    <div className="mb-3">{iconByMime(file.mimetype)}</div>
                    <h6 className="card-title text-truncate">
                      {file.originalName}
                    </h6>
                    <p className="text-muted small mb-1">
                      {formatFileSize(file.size)}
                    </p>
                    <div className="d-flex gap-1 justify-content-center flex-wrap mb-1">
                      {file.classification?.category && (
                        <span className="badge bg-info text-dark">
                          {file.classification.category}
                        </span>
                      )}
                      {file.isDuplicate && (
                        <span className="badge bg-warning text-dark">
                          Duplicate
                        </span>
                      )}
                      {file.isFavorite && (
                        <span className="badge bg-warning text-dark">
                          <FaStar className="me-1" />
                          Favorite
                        </span>
                      )}
                      {file.isPinned && (
                        <span className="badge bg-dark">
                          <FaThumbtack className="me-1" />
                          Pinned
                        </span>
                      )}
                    </div>
                    {file.isShared && file.ownerEmail && (
                      <p className="text-info small mb-0">
                        <FaUsers className="me-1" />
                        Shared by {file.ownerEmail}
                      </p>
                    )}
                    <div className="file-card-actions" role="group">
                      <button
                        className={`btn btn-sm file-card-action-btn ${file.isFavorite ? "btn-warning" : "btn-outline-warning"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(file);
                        }}
                        title={file.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        {file.isFavorite ? <FaStar /> : <FaRegStar />}
                      </button>
                      <button
                        className={`btn btn-sm file-card-action-btn ${file.isPinned ? "btn-dark" : "btn-outline-dark"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinned(file);
                        }}
                        title={file.isPinned ? "Unpin" : "Pin Document"}
                      >
                        <FaThumbtack />
                      </button>
                      <a
                        className="btn btn-sm btn-outline-primary file-card-action-btn"
                        href={`${BACKEND_URL}/preview/${file.filename}?userId=${userId}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          trackAccess(file, "PREVIEW");
                        }}
                      >
                        <FaEye />
                      </a>
                      <a
                        className="btn btn-sm btn-outline-success file-card-action-btn"
                        href={`${BACKEND_URL}/download/${file.filename}?userId=${userId}`}
                        title="Download"
                        onClick={(e) => {
                          e.stopPropagation();
                          trackAccess(file, "DOWNLOAD");
                        }}
                      >
                        <FaCloudDownloadAlt />
                      </a>
                      {isEditableFile(file) && (
                        <button
                          className="btn btn-sm btn-outline-dark file-card-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            trackAccess(file, "EDITOR_OPEN");
                            navigate(`/editor/${file._id}`);
                          }}
                          title="Edit in built-in editor"
                        >
                          <FaEdit />
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-secondary file-card-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVersionTarget({ type: "file", item: file });
                        }}
                        title="Version History"
                      >
                        <FaHistory />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary file-card-action-btn"
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
          //  List view (use paginated arrays)
          <div className="table-container documents-spotlight-table">
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
                  {paginatedFolders.map((folder) => (
                    <tr
                      key={folder._id}
                      onContextMenu={(e) =>
                        handleContextMenu(e, { type: "folder", data: folder })
                      }
                      onClick={() =>
                        setSelectedItem({ type: "folder", data: folder })
                      }
                      className={
                        selectedItem?.data?._id === folder._id
                          ? "table-active"
                          : ""
                      }
                    >
                      <td
                        role="button"
                        onDoubleClick={() => goInto(folder._id)}
                        className="d-flex align-items-center"
                      >
                        <FaFolder className="text-warning me-2" />
                        <span className="text-truncate">{folder.name}</span>
                      </td>
                      <td>Folder</td>
                      <td>
                        {folder.isShared && folder.ownerEmail ? (
                          <span className="text-info">
                            <FaUsers className="me-1" />
                            {folder.ownerEmail}
                          </span>
                        ) : (
                          <span className="text-muted">You</span>
                        )}
                      </td>
                      <td>—</td>
                      <td>{new Date(folder.createdAt).toLocaleDateString()}</td>
                      <td className="text-center">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => goInto(folder._id)}
                            title="Open"
                          >
                            <FaEye />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setVersionTarget({ type: "folder", item: folder })
                            }
                            title="Version History"
                          >
                            <FaHistory />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setCommentsTarget({ type: "folder", item: folder })
                            }
                            title="Comments"
                          >
                            <FaComment />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setMoveTarget({ type: "folder", item: folder })
                            }
                            title="Move"
                          >
                            <FaArrowsAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setShareTarget({ type: "folder", item: folder })
                            }
                            title="Share"
                          >
                            <FaShareAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteFolder(folder)}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setRenameTarget({ type: "folder", data: folder })
                            }
                            title="Rename"
                          >
                            <FaFileSignature />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedFiles.map((file) => (
                    <tr
                      key={file._id}
                      onContextMenu={(e) =>
                        handleContextMenu(e, { type: "file", data: file })
                      }
                      onClick={() =>
                        setSelectedItem({ type: "file", data: file })
                      }
                      className={
                        selectedItem?.data?._id === file._id
                          ? "table-active"
                          : ""
                      }
                    >
                      <td className="d-flex align-items-center">
                        <span className="me-2">
                          {iconByMime(file.mimetype)}
                        </span>
                        <span className="text-truncate">
                          {file.originalName}
                        </span>
                        <div className="ms-2 d-flex gap-1">
                          {file.classification?.category && (
                            <span className="badge bg-info text-dark">
                              {file.classification.category}
                            </span>
                          )}
                          {file.isDuplicate && (
                            <span className="badge bg-warning text-dark">
                              Duplicate
                            </span>
                          )}
                          {file.isFavorite && (
                            <span className="badge bg-warning text-dark">
                              <FaStar />
                            </span>
                          )}
                          {file.isPinned && (
                            <span className="badge bg-dark">
                              <FaThumbtack />
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{file.mimetype.split("/")[1] || file.mimetype}</td>
                      <td>
                        {file.isShared && file.ownerEmail ? (
                          <span className="text-info">
                            <FaUsers className="me-1" />
                            {file.ownerEmail}
                          </span>
                        ) : (
                          <span className="text-muted">You</span>
                        )}
                      </td>
                      <td>{formatFileSize(file.size)}</td>
                      <td>{new Date(file.uploadDate).toLocaleDateString()}</td>
                      <td className="text-center">
                        <div className="btn-group flex-wrap gap-1 justify-content-center">
                          <button
                            className={`btn btn-sm ${file.isFavorite ? "btn-warning" : "btn-outline-warning"}`}
                            onClick={() => toggleFavorite(file)}
                            title={file.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                          >
                            {file.isFavorite ? <FaStar /> : <FaRegStar />}
                          </button>
                          <button
                            className={`btn btn-sm ${file.isPinned ? "btn-dark" : "btn-outline-dark"}`}
                            onClick={() => togglePinned(file)}
                            title={file.isPinned ? "Unpin" : "Pin Document"}
                          >
                            <FaThumbtack />
                          </button>
                          <a
                            className="btn btn-sm btn-outline-primary"
                            href={`${BACKEND_URL}/preview/${file.filename}?userId=${userId}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Preview"
                            onClick={() => trackAccess(file, "PREVIEW")}
                          >
                            <FaEye />
                          </a>
                          <a
                            className="btn btn-sm btn-outline-success"
                            href={`${BACKEND_URL}/download/${file.filename}?userId=${userId}`}
                            title="Download"
                            onClick={() => trackAccess(file, "DOWNLOAD")}
                          >
                            <FaCloudDownloadAlt />
                          </a>
                          {isEditableFile(file) && (
                            <button
                              className="btn btn-sm btn-outline-dark"
                              onClick={() => {
                                trackAccess(file, "EDITOR_OPEN");
                                navigate(`/editor/${file._id}`);
                              }}
                              title="Edit in built-in editor"
                            >
                              <FaEdit />
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setVersionTarget({ type: "file", item: file })
                            }
                            title="Version History"
                          >
                            <FaHistory />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setCommentsTarget({ type: "file", item: file })
                            }
                            title="Comments"
                          >
                            <FaComment />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setMoveTarget({ type: "file", item: file })
                            }
                            title="Move"
                          >
                            <FaArrowsAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setShareTarget({ type: "file", item: file })
                            }
                            title="Share"
                          >
                            <FaShareAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteFile(file)}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setRenameTarget({ type: "file", data: file })
                            }
                            title="Rename"
                          >
                            <FaFileSignature />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ✅ Load More */}
        {(visibleFolders.length > itemsToShow ||
          visibleFiles.length > itemsToShow) && (
          <div className="text-center mt-4">
            <button
              className="btn btn-outline-primary"
              onClick={handleLoadMore}
            >
              Load More
            </button>
          </div>
        )}

        {/* Empty State */}
        {visibleFolders.length === 0 && visibleFiles.length === 0 && (
          <div className="text-center py-5 empty-state">
            <FaFolder className="text-muted mb-3" size={48} />
            <h5 className="text-muted">This is empty</h5>
            <p className="text-muted">
              Upload files or create a new folder to get started
            </p>
            <button
              className="btn btn-primary me-2"
              onClick={() => setShowUpload(true)}
            >
              <FaUpload className="me-1" /> Upload Files
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => setShowCreate(true)}
            >
              <FaPlus className="me-1" /> New Folder
            </button>
          </div>
        )}

        {/* File/Folder Actions Modal */}
        {contextMenu.visible && (
          <div className="modal d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {contextMenu.item.type === "folder" ? (
                      <>
                        <FaFolder className="text-warning me-2" />
                        {contextMenu.item.data.name}
                      </>
                    ) : (
                      <>
                        <FaFileAlt className="text-primary me-2" />
                        {contextMenu.item.data.originalName}
                      </>
                    )}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setContextMenu({ visible: false, item: null })}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="d-grid gap-2">
                    {contextMenu.item.type === "folder" ? (
                      <>
                        <button
                          className="btn btn-outline-primary d-flex align-items-center"
                          onClick={() => {
                            goInto(contextMenu.item.data._id);
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaEye className="me-2" />
                          Open Folder
                        </button>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center"
                          onClick={() => {
                            setMoveTarget({
                              type: "folder",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaArrowsAlt className="me-2" />
                          Move
                        </button>
                        <button
                          className="btn btn-outline-info d-flex align-items-center"
                          onClick={() => {
                            setShareTarget({
                              type: "folder",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaShareAlt className="me-2" />
                          Share
                        </button>
                        <button
                          className="btn btn-outline-warning d-flex align-items-center"
                          onClick={() => {
                            setManageSharesTarget({
                              type: "folder",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaUsers className="me-2" />
                          Manage Shares
                        </button>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center"
                          onClick={() => {
                            setVersionTarget({
                              type: "folder",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaHistory className="me-2" />
                          Version History
                        </button>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center"
                          onClick={() => {
                            setCommentsTarget({
                              type: "folder",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaComment className="me-2" />
                          Comments
                        </button>
                        <hr />
                        <button
                          className="btn btn-outline-success d-flex align-items-center"
                          onClick={() => {
                            setRenameTarget(contextMenu.item);
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaFileSignature className="me-2" />
                          Rename
                        </button>
                        <button
                          className="btn btn-outline-danger d-flex align-items-center"
                          onClick={() => {
                            deleteFolder(contextMenu.item.data);
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaTrash className="me-2" />
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          className="btn btn-outline-primary d-flex align-items-center"
                          href={`${BACKEND_URL}/preview/${contextMenu.item.data.filename}?userId=${userId}&role=${role}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => {
                            trackAccess(contextMenu.item.data, "PREVIEW");
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaEye className="me-2" />
                          Preview
                        </a>
                        <a
                          className="btn btn-outline-success d-flex align-items-center"
                          href={`${BACKEND_URL}/download/${contextMenu.item.data.filename}?userId=${userId}`}
                          onClick={() => {
                            trackAccess(contextMenu.item.data, "DOWNLOAD");
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaCloudDownloadAlt className="me-2" />
                          Download
                        </a>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center"
                          onClick={() => {
                            setMoveTarget({ type: "file", item: contextMenu.item.data });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaArrowsAlt className="me-2" />
                          Move
                        </button>
                        <button
                          className="btn btn-outline-info d-flex align-items-center"
                          onClick={() => {
                            setShareTarget({
                              type: "file",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaShareAlt className="me-2" />
                          Share
                        </button>
                        <button
                          className="btn btn-outline-warning d-flex align-items-center"
                          onClick={() => {
                            setManageSharesTarget({
                              type: "file",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaUsers className="me-2" />
                          Manage Shares
                        </button>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center"
                          onClick={() => {
                            setVersionTarget({
                              type: "file",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaHistory className="me-2" />
                          Version History
                        </button>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center"
                          onClick={() => {
                            setCommentsTarget({
                              type: "file",
                              item: contextMenu.item.data,
                            });
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaComment className="me-2" />
                          Comments
                        </button>
                        {isEditableFile(contextMenu.item.data) && (
                          <button
                            className="btn btn-outline-dark d-flex align-items-center"
                            onClick={() => {
                              trackAccess(contextMenu.item.data, "EDITOR_OPEN");
                              navigate(`/editor/${contextMenu.item.data._id}`);
                              setContextMenu({ visible: false, item: null });
                            }}
                          >
                            <FaEdit className="me-2" />
                            Edit Document
                          </button>
                        )}
                        <button
                          className={`btn d-flex align-items-center ${contextMenu.item.data.isFavorite ? "btn-warning" : "btn-outline-warning"}`}
                          onClick={() => {
                            toggleFavorite(contextMenu.item.data);
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          {contextMenu.item.data.isFavorite ? <FaStar className="me-2" /> : <FaRegStar className="me-2" />}
                          {contextMenu.item.data.isFavorite ? "Remove Favorite" : "Add to Favorites"}
                        </button>
                        <button
                          className={`btn d-flex align-items-center ${contextMenu.item.data.isPinned ? "btn-dark" : "btn-outline-dark"}`}
                          onClick={() => {
                            togglePinned(contextMenu.item.data);
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaThumbtack className="me-2" />
                          {contextMenu.item.data.isPinned ? "Unpin Document" : "Pin Document"}
                        </button>
                        <hr />
                        <button
                          className="btn btn-outline-success d-flex align-items-center"
                          onClick={() => {
                            setRenameTarget(contextMenu.item);
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaFileSignature className="me-2" />
                          Rename
                        </button>
                        <button
                          className="btn btn-outline-danger d-flex align-items-center"
                          onClick={() => {
                            deleteFile(contextMenu.item.data);
                            setContextMenu({ visible: false, item: null });
                          }}
                        >
                          <FaTrash className="me-2" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setContextMenu({ visible: false, item: null })}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showCreate && (
          <>
            <div className="modal-backdrop fade show"></div>
            <CreateFolderModal
              onClose={() => setShowCreate(false)}
              onCreated={(folder) => setFolders((s) => [folder, ...s])}
              parentFolder={currentFolder}
            />
          </>
        )}
        {showUpload && (
          <>
            <div className="modal-backdrop fade show"></div>
            <UploadModal
              onClose={() => setShowUpload(false)}
              onUploaded={(created) => setFiles((s) => [created, ...s])}
              parentFolder={currentFolder}
            />
          </>
        )}
        {moveTarget && (
          <>
            <div className="modal-backdrop fade show"></div>
            <MoveModal
              onClose={() => setMoveTarget(null)}
              target={moveTarget}
              currentFolder={currentFolder}
              onMoved={() => {
                setMoveTarget(null);
                fetchFolderContents(currentFolder);
              }}
            />
          </>
        )}
        {shareTarget && (
          <>
            <div className="modal-backdrop fade show"></div>
            <ShareModal
              onClose={() => setShareTarget(null)}
              target={shareTarget}
            />
          </>
        )}
        {manageSharesTarget && (
          <>
            <div className="modal-backdrop fade show"></div>
            <ManageSharesModal
              onClose={() => setManageSharesTarget(null)}
              target={manageSharesTarget}
              onUpdated={() => fetchFolderContents(currentFolder)}
            />
          </>
        )}
        {/* ✅ Rename Modal */}
        {renameTarget && (
          <>
            <div className="modal-backdrop fade show"></div>
            <RenameModal
              item={renameTarget}
              onClose={() => setRenameTarget(null)}
              onRenamed={(updated) => {
                setRenameTarget(null);
                if (renameTarget.type === "file") {
                  setFiles((prev) =>
                    prev.map((f) => (f._id === updated._id ? updated : f))
                  );
                } else {
                  setFolders((prev) =>
                    prev.map((f) => (f._id === updated._id ? updated : f))
                  );
                }
              }}
            />
          </>
        )}
        {versionTarget && (
          <>
            <div className="modal-backdrop fade show"></div>
            <VersionModal
              onClose={() => setVersionTarget(null)}
              target={versionTarget}
              onRestored={() => fetchFolderContents(currentFolder)}
            />
          </>
        )}
        {commentsTarget && (
          <>
            <div className="modal-backdrop fade show"></div>
            <CommentsModal
              onClose={() => setCommentsTarget(null)}
              target={commentsTarget}
            />
          </>
        )}
      </div>
    </>
  );
}
