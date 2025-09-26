import React, { useEffect, useMemo, useState } from "react";
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
  FaEye
} from "react-icons/fa";

import CreateFolderModal from "../components/CreateFolderModal.jsx";
import MoveModal from "../components/MoveModal";
import ShareModal from "../components/ShareModal";
import UploadModal from "../components/UploadModal";
import { useOutletContext } from "react-router-dom";

const API = "http://localhost:3001";

export default function Home() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);

  const [view, setView] = useState("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });

  const { searchResults } = useOutletContext();

  // Fetch folders + files + breadcrumbs
  const fetchFolderContents = async (folderId) => {
    const params = { userId, role, parentFolder: folderId || "" };
    const [fdrRes, filRes, bcRes] = await Promise.all([
      axios.get(`${API}/folders`, { params }),
      axios.get(`${API}/files`, { params }),
      axios.get(`${API}/breadcrumbs`, { params: { folderId } }),
    ]);
    setFolders(fdrRes.data);
    setFiles(filRes.data);
    setBreadcrumbs(bcRes.data);
  };

  const [myFolders, setMyFolders] = useState([]);
  const [myFiles, setMyFiles] = useState([]);

  useEffect(() => {
    const fetchMyDrive = async () => {
      const res = await axios.get("http://localhost:3001/folders", {
        params: { userId, parentFolder: currentFolderId },
      });
      setMyFolders(res.data);
    };
    fetchMyDrive();
  }, [currentFolderId]);

  useEffect(() => {
    fetchFolderContents(currentFolder).catch(console.error);
  }, [currentFolder, userId, role]);

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

  const goInto = (folderId) => setCurrentFolder(folderId);
  const goUp = () => {
    if (!breadcrumbs.length) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    setCurrentFolder(parent ? parent._id : null);
  };

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Delete folder "${folder.name}" and its contents?`))
      return;
    await axios.delete(`${API}/folders/${folder._id}`, {
      params: { userId, role },
    });
    setFolders((s) => s.filter((f) => f._id !== folder._id));
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Delete file "${file.originalName}"?`)) return;
    await axios.delete(`${API}/files/${file._id}`, {
      params: { userId, role },
    });
    setFiles((s) => s.filter((f) => f._id !== file._id));
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setSelectedItem(item);
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      item: item
    });
  };

  const handleClick = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  useEffect(() => {
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Use search results if available, otherwise show normal
  const visibleFiles = searchResults || files;
  const visibleFolders = searchResults ? [] : folders;

  return (
    <>
      <div className="container-fluid py-3 file-manager-container">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          {/* Breadcrumbs */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {currentFolder && (
              <button className="btn btn-outline-secondary" onClick={goUp}>
                <FaArrowLeft className="me-1" /> Back
              </button>
            )}
            <div className="d-flex align-items-center flex-wrap overflow-auto">
              <span className="fw-bold me-2 text-primary">My Drive</span>
              {breadcrumbs.length > 0 &&
                breadcrumbs.map((b, index) => (
                  <span key={b._id || 'root'} className="d-flex align-items-center">
                    <FaChevronRight className="mx-2 text-muted" size={12} />
                    <button
                      className="btn btn-link p-0 text-dark text-decoration-none"
                      onClick={() => setCurrentFolder(b._id || null)}
                    >
                      {b.name || "Root"}
                    </button>
                  </span>
                ))}
            </div>
          </div>

          {/* View Toggles and Actions */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="btn-group" role="group">
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
              className="btn btn-primary d-flex align-items-center"
              onClick={() => setShowCreate(true)}
            >
              <FaPlus className="me-1" /> New Folder
            </button>
            <button
              className="btn btn-success d-flex align-items-center"
              onClick={() => setShowUpload(true)}
            >
              <FaUpload className="me-1" /> Upload
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card stats-card">
              <div className="card-body py-2">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">
                    {folders.length} folder{folders.length !== 1 ? 's' : ''}, {files.length} file{files.length !== 1 ? 's' : ''}
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
            {/* Folders */}
            {visibleFolders.map((folder) => (
              <div
                key={folder._id}
                className="col-6 col-sm-4 col-md-3 col-xl-2"
                onContextMenu={(e) => handleContextMenu(e, { type: 'folder', data: folder })}
                onClick={() => setSelectedItem({ type: 'folder', data: folder })}
              >
                <div className={`card folder-card h-100 ${selectedItem?.data?._id === folder._id ? 'selected' : ''}`}>
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
                          setContextMenu({
                            visible: true,
                            x: e.pageX,
                            y: e.pageY,
                            item: { type: 'folder', data: folder }
                          });
                        }}
                      >
                        <FaEllipsisV />
                      </button>
                    </div>
                    <FaFolder size={42} className="text-warning mb-3 folder-icon" />
                    <h6 className="card-title text-truncate">{folder.name}</h6>
                    <p className="text-muted small mb-0">Folder</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Files */}
            {visibleFiles.map((file) => (
              <div
                key={file._id}
                className="col-6 col-sm-4 col-md-3 col-xl-2"
                onContextMenu={(e) => handleContextMenu(e, { type: 'file', data: file })}
                onClick={() => setSelectedItem({ type: 'file', data: file })}
              >
                <div className={`card file-card h-100 ${selectedItem?.data?._id === file._id ? 'selected' : ''}`}>
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
                            item: { type: 'file', data: file }
                          });
                        }}
                      >
                        <FaEllipsisV />
                      </button>
                    </div>
                    <div className="mb-3">{iconByMime(file.mimetype)}</div>
                    <h6 className="card-title text-truncate">{file.originalName}</h6>
                    <p className="text-muted small">{formatFileSize(file.size)}</p>
                    <div className="btn-group w-100" role="group">
                      <a
                        className="btn btn-sm btn-outline-primary"
                        href={`${API}/view/${file.filename}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Preview"
                      >
                        <FaEye />
                      </a>
                      <a
                        className="btn btn-sm btn-outline-success"
                        href={`${API}/download/${file.filename}`}
                        title="Download"
                      >
                        <FaCloudDownloadAlt />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
         
          // LIST VIEW
<div className="table-container">
  {/* ✅ Added responsive wrapper */}
  <div className="table-responsive">
    <table className="table table-hover align-middle">
      <thead className="table-light">
        <tr>
          <th style={{ minWidth: "280px", whiteSpace: "nowrap" }}>Name</th>
          <th style={{ minWidth: "180px", whiteSpace: "nowrap" }}>Type</th>
          <th style={{ minWidth: "120px", whiteSpace: "nowrap" }}>Size</th>
          <th style={{ minWidth: "180px", whiteSpace: "nowrap" }}>Modified</th>
          <th
            style={{ minWidth: "160px", whiteSpace: "nowrap" }}
            className="text-center"
          >
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {visibleFolders.map((folder) => (
          <tr
            key={folder._id}
            onContextMenu={(e) =>
              handleContextMenu(e, { type: "folder", data: folder })
            }
            onClick={() =>
              setSelectedItem({ type: "folder", data: folder })
            }
            className={
              selectedItem?.data?._id === folder._id ? "table-active" : ""
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
              </div>
            </td>
          </tr>
        ))}
        {visibleFiles.map((file) => (
          <tr
            key={file._id}
            onContextMenu={(e) =>
              handleContextMenu(e, { type: "file", data: file })
            }
            onClick={() =>
              setSelectedItem({ type: "file", data: file })
            }
            className={
              selectedItem?.data?._id === file._id ? "table-active" : ""
            }
          >
            <td className="d-flex align-items-center">
              <span className="me-2">{iconByMime(file.mimetype)}</span>
              <span className="text-truncate">{file.originalName}</span>
            </td>
            <td>{file.mimetype.split("/")[1] || file.mimetype}</td>
            <td>{formatFileSize(file.size)}</td>
            <td>{new Date(file.uploadDate).toLocaleDateString()}</td>
            <td className="text-center">
              <div className="btn-group">
                <a
                  className="btn btn-sm btn-outline-primary"
                  href={`${API}/view/${file.filename}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Preview"
                >
                  <FaEye />
                </a>
                <a
                  className="btn btn-sm btn-outline-success"
                  href={`${API}/download/${file.filename}`}
                  title="Download"
                >
                  <FaCloudDownloadAlt />
                </a>
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
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

        )}

        {/* Empty State */}
        {visibleFolders.length === 0 && visibleFiles.length === 0 && (
          <div className="text-center py-5 empty-state">
            <FaFolder className="text-muted mb-3" size={48} />
            <h5 className="text-muted">This is empty</h5>
            <p className="text-muted">Upload files or create a new folder to get started</p>
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

        {/* Context Menu */}
        {contextMenu.visible && (
          <div 
            className="context-menu show" 
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-menu-header">
              {contextMenu.item.type === 'folder' ? (
                <><FaFolder className="text-warning me-2" /> {contextMenu.item.data.name}</>
              ) : (
                <><FaFileAlt className="text-primary me-2" /> {contextMenu.item.data.originalName}</>
              )}
            </div>
            <div className="context-menu-divider"></div>
            {contextMenu.item.type === 'folder' ? (
              <>
                <button className="context-menu-item" onClick={() => goInto(contextMenu.item.data._id)}>
                  <FaEye className="me-2" /> Open
                </button>
                <button className="context-menu-item" onClick={() => setMoveTarget({ type: "folder", item: contextMenu.item.data })}>
                  <FaArrowsAlt className="me-2" /> Move
                </button>
                <button className="context-menu-item" onClick={() => setShareTarget({ type: "folder", item: contextMenu.item.data })}>
                  <FaShareAlt className="me-2" /> Share
                </button>
                <div className="context-menu-divider"></div>
                <button className="context-menu-item text-danger" onClick={() => deleteFolder(contextMenu.item.data)}>
                  <FaTrash className="me-2" /> Delete
                </button>
              </>
            ) : (
              <>
                <a className="context-menu-item" href={`${API}/view/${contextMenu.item.data.filename}`} target="_blank" rel="noreferrer">
                  <FaEye className="me-2" /> Preview
                </a>
                <a className="context-menu-item" href={`${API}/download/${contextMenu.item.data.filename}`}>
                  <FaCloudDownloadAlt className="me-2" /> Download
                </a>
                <button className="context-menu-item" onClick={() => setMoveTarget({ type: "file", item: contextMenu.item.data })}>
                  <FaArrowsAlt className="me-2" /> Move
                </button>
                <button className="context-menu-item" onClick={() => setShareTarget({ type: "file", item: contextMenu.item.data })}>
                  <FaShareAlt className="me-2" /> Share
                </button>
                <div className="context-menu-divider"></div>
                <button className="context-menu-item text-danger" onClick={() => deleteFile(contextMenu.item.data)}>
                  <FaTrash className="me-2" /> Delete
                </button>
              </>
            )}
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
      </div>
    </>
  );
}