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
  } from "react-icons/fa";

  import CreateFolderModal from "../components/CreateFolderModal.jsx";
  import MoveModal from "../components/MoveModal";
  import ShareModal from "../components/ShareModal";
  import UploadModal from "../components/UploadModal";
  import "../pages/home.css";

  const API = "http://localhost:3001";

  export default function Home() {
    const userId = localStorage.getItem("userId");
    const role = localStorage.getItem("role") || "user";

    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);

    const [view, setView] = useState("grid");
    const [showCreate, setShowCreate] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [moveTarget, setMoveTarget] = useState(null);
    const [shareTarget, setShareTarget] = useState(null);

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

    useEffect(() => {
      fetchFolderContents(currentFolder).catch(console.error);
    }, [currentFolder, userId, role]);

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

    return (
      <>
        <div className="container-fluid py-3">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            {/* Breadcrumbs */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {currentFolder && (
                <button className="btn btn-light" onClick={goUp}>
                  <FaArrowLeft className="btn-l" />
                </button>
              )}
              <div className="d-flex align-items-center flex-wrap overflow-auto">
                {/* Always show the root */}
                <span className="fw-bold me-2">Welcome to DocuDB</span>

                {/* Only render breadcrumbs if currentFolder is not null */}
                {breadcrumbs.length > 1 &&
                  breadcrumbs.slice(1).map((b, index) => (
                    <span key={b._id} className="d-flex align-items-center">
                      <FaChevronRight className="mx-2 text-muted" />
                      <button
                        className="btn btn-link p-0"
                        onClick={() => setCurrentFolder(b._id || null)}
                      >
                        {b.name || "Root"}
                      </button>
                    </span>
                  ))}
              </div>
            </div>

            {/* Actions */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                className={`btn ${view === "grid" ? "btn-primary" : "btn-light"}`}
                onClick={() => setView("grid")}
              >
                <FaTh />
              </button>
              <button
                className={`btn ${view === "list" ? "btn-primary" : "btn-light"}`}
                onClick={() => setView("list")}
              >
                <FaList />
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowCreate(true)}
              >
                <FaPlus className="me-1" /> New Folder
              </button>
              <button
                className="btn btn-outline-success "
                onClick={() => setShowUpload(true)}
              >
                <FaUpload className="me-1" /> Upload
              </button>
            </div>
          </div>

          {/* GRID VIEW */}
          {view === "grid" ? (
            <>
              {/* Folders */}
              <div className="row g-3 mb-3">
                {folders.map((folder) => (
                  <div
                    key={folder._id}
                    className="col-6 col-sm-4 col-md-3 col-lg-2"
                  >
                    <div className="card p-3 h-100 shadow-sm">
                      <div
                        className="text-center"
                        role="button"
                        onDoubleClick={() => goInto(folder._id)}
                      >
                        <FaFolder size={40} className="text-warning mb-2" />
                        <div className="text-truncate fw-semibold">
                          {folder.name}
                        </div>
                      </div>
                      <div className="d-flex justify-content-center gap-2 mt-2 flex-wrap">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() =>
                            setMoveTarget({ type: "folder", item: folder })
                          }
                        >
                          <FaArrowsAlt />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() =>
                            setShareTarget({ type: "folder", item: folder })
                          }
                        >
                          <FaShareAlt />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteFolder(folder)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Files */}
              <div className="row g-3">
                {files.map((file) => (
                  <div
                    key={file._id}
                    className="col-6 col-sm-4 col-md-3 col-lg-2 w-25"
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
                          onClick={() =>
                            setMoveTarget({ type: "file", item: file })
                          }
                        >
                          <FaArrowsAlt />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() =>
                            setShareTarget({ type: "file", item: file })
                          }
                        >
                          <FaShareAlt />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteFile(file)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // LIST VIEW
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Modified</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder) => (
                    <tr key={folder._id}>
                      <td role="button" onDoubleClick={() => goInto(folder._id)}>
                        <FaFolder className="text-warning me-2" /> {folder.name}
                      </td>
                      <td>Folder</td>
                      <td>—</td>
                      <td>{new Date(folder.createdAt).toLocaleString()}</td>
                      <td className="text-end">
                        <div className="btn-group flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setMoveTarget({ type: "folder", item: folder })
                            }
                          >
                            <FaArrowsAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setShareTarget({ type: "folder", item: folder })
                            }
                          >
                            <FaShareAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteFolder(folder)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {files.map((file) => (
                    <tr key={file._id}>
                      <td>
                        {iconByMime(file.mimetype)}{" "}
                        <span className="ms-2">{file.originalName}</span>
                      </td>
                      <td>{file.mimetype}</td>
                      <td>{(file.size / 1024).toFixed(1)} KB</td>
                      <td>{new Date(file.uploadDate).toLocaleString()}</td>
                      <td className="text-end">
                        <div className="btn-group flex-wrap">
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
                            onClick={() =>
                              setMoveTarget({ type: "file", item: file })
                            }
                          >
                            <FaArrowsAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setShareTarget({ type: "file", item: file })
                            }
                          >
                            <FaShareAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteFile(file)}
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
          )}

          {/* Modals */}
          {showCreate && (
            <>
              {" "}
              <div className="modal-backdrop fade show"></div>
              <CreateFolderModal
                onClose={() => setShowCreate(false)}
                onCreated={(folder) => setFolders((s) => [folder, ...s])}
                parentFolder={currentFolder}
              />{" "}
            </>
          )}
          {showUpload && (
            <>
              {" "}
              <div className="modal-backdrop fade show"></div>
              <UploadModal
                onClose={() => setShowUpload(false)}
                onUploaded={(created) => setFiles((s) => [created, ...s])}
                parentFolder={currentFolder}
              />
            </>
          )}
          {moveTarget && (
            <MoveModal
              onClose={() => setMoveTarget(null)}
              target={moveTarget}
              currentFolder={currentFolder}
              onMoved={() => {
                setMoveTarget(null);
                fetchFolderContents(currentFolder);
              }}
            />
          )}
          {shareTarget && (
            <ShareModal
              onClose={() => setShareTarget(null)}
              target={shareTarget}
            />
          )}
        </div>
      </>
    );
  }
