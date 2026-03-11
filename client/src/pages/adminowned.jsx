import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaFolder,
  FaFileAlt,
  FaChevronRight,
  FaArrowLeft,
  FaPlus,
  FaUpload,
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
  FaShareAlt,
  FaFileSignature,
  FaEllipsisV,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

import CreateFolderModal from "../components/CreateFolderModal";
import UploadModal from "../components/UploadModal";
import ShareModal from "../components/ShareModal";
import RenameModal from "../components/RenameModal";
import { BACKEND_URL } from "../config";
import { isExternalFileDrag, uploadDroppedEntries } from "../utils/dropUpload";

const PREDEFINED_FOLDER_SETS = {
  copc_bsit: [
    "COPC_BSIT",
    "01 Program Profile",
    "02 Curriculum",
    "03 Faculty",
    "04 Facilities",
    "05 Library",
    "06 Administration",
    "07 Supporting Documents",
  ],
  academic: ["Admissions", "Registrar", "Curriculum", "Faculty", "Research", "Student Affairs"],
  operations: ["HR", "Finance", "Legal", "Procurement", "IT", "Compliance"],
};

const TASK_TEMPLATE_SETS = {
  copc_bsit: [
    { title: "Program Profile Review", scope: "Program Profile" },
    { title: "Curriculum Standards Compliance", scope: "Curriculum" },
    { title: "Faculty Qualification Compliance", scope: "Faculty" },
    { title: "Facilities Standards Check", scope: "Facilities" },
    { title: "Library Resources Compliance", scope: "Library" },
    { title: "Administration Policy Compliance", scope: "Administration" },
    { title: "Supporting Documents Validation", scope: "Supporting Documents" },
  ],
};

export default function AdminOwnedPage() {
  const role = localStorage.getItem("role") || "superadmin";
  const userId = localStorage.getItem("userId");
  const userEmail = localStorage.getItem("email");
  const normalizeRole = (value) => {
    const raw = String(value || "").toLowerCase();
    if (raw === "admin") return "superadmin";
    if (raw === "user") return "faculty";
    if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
    if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
    if (raw === "reviewer") return "evaluator";
    return raw;
  };
  const isAdmin = normalizeRole(role) === "superadmin";
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [folderQuery, setFolderQuery] = useState("");
  const [view, setView] = useState("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [dragPayload, setDragPayload] = useState(null);
  const [activeDropFolderId, setActiveDropFolderId] = useState("");
  const [movingByDrop, setMovingByDrop] = useState(false);
  const [externalDropActive, setExternalDropActive] = useState(false);
  const [uploadingDroppedItems, setUploadingDroppedItems] = useState(false);
  const [dropUploadMessage, setDropUploadMessage] = useState("");
  const [contextMenu, setContextMenu] = useState({ visible: false, item: null });
  const [users, setUsers] = useState([]);
  const [folderTasks, setFolderTasks] = useState([]);
  const [taskProgress, setTaskProgress] = useState(0);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [assignments, setAssignments] = useState({ uploaders: [], programChairs: [], qaOfficers: [] });
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(true);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetKey, setPresetKey] = useState("copc_bsit");
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [templateKey, setTemplateKey] = useState("copc_bsit");
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [searchUploader, setSearchUploader] = useState("");
  const [searchChair, setSearchChair] = useState("");
  const [searchQa, setSearchQa] = useState("");
  const [selectedUploaderId, setSelectedUploaderId] = useState("");
  const [selectedChairId, setSelectedChairId] = useState("");
  const [selectedQaId, setSelectedQaId] = useState("");
  const { searchResults } = useOutletContext();
  const navigate = useNavigate();

  const fetchOwnedContents = useCallback(async (folderId) => {
    try {
      const params = { role, parentFolder: folderId || "" };
      const [fdrRes, filRes, bcRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/folders`, { params }),
        axios.get(`${BACKEND_URL}/files`, { params }),
        axios.get(`${BACKEND_URL}/breadcrumbs`, { params: { folderId } }),
      ]);

      const isOwned = (owner) => (owner?._id || owner)?.toString?.() === userId?.toString();
      setFolders((fdrRes.data || []).filter((f) => isOwned(f.owner)));
      setFiles((filRes.data || []).filter((f) => isOwned(f.owner)));
      setBreadcrumbs(bcRes.data || []);
    } catch (err) {
      console.error("Failed to fetch admin-owned contents:", err);
    }
  }, [role, userId]);

  const createPredefinedFolders = async () => {
    const names = PREDEFINED_FOLDER_SETS[presetKey] || [];
    if (!names.length) return;
    try {
      setCreatingPreset(true);
      const existingNames = new Set(
        (folders || []).map((f) => String(f?.name || "").trim().toLowerCase())
      );
      const toCreate = names.filter((name) => !existingNames.has(name.toLowerCase()));
      if (!toCreate.length) {
        alert("All predefined folders already exist in this location.");
        return;
      }
      await Promise.all(
        toCreate.map((name) =>
          axios.post(`${BACKEND_URL}/folders`, {
            name,
            owner: userId,
            role,
            parentFolder: currentFolderId || null,
            isPredefinedRoot: true,
            predefinedTemplateKey: presetKey,
          })
        )
      );
      await fetchOwnedContents(currentFolderId);
      setShowPresetModal(false);
      alert(`Created ${toCreate.length} predefined folder(s).`);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to create predefined folders");
    } finally {
      setCreatingPreset(false);
    }
  };

  useEffect(() => {
    fetchOwnedContents(currentFolderId);
  }, [fetchOwnedContents, currentFolderId]);

  useEffect(() => {
    setFolderQuery("");
  }, [currentFolderId]);

  useEffect(() => {
    if (!isAdmin) return;
    axios.get(`${BACKEND_URL}/users`, { params: { role } })
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]));
  }, [isAdmin, role]);

  const fetchTasks = useCallback(async (folderId) => {
    if (!folderId) {
      setFolderTasks([]);
      setTaskProgress(0);
      setAssignments({ uploaders: [], programChairs: [], qaOfficers: [] });
      return;
    }
    try {
      const { data } = await axios.get(`${BACKEND_URL}/folders/${folderId}/tasks`, {
        params: { userId, role },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
      setAssignments(data?.assignments || { uploaders: [], programChairs: [], qaOfficers: [] });
    } catch {
      setFolderTasks([]);
      setTaskProgress(0);
      setAssignments({ uploaders: [], programChairs: [], qaOfficers: [] });
    }
  }, [role, userId]);

  useEffect(() => {
    fetchTasks(currentFolderId);
  }, [currentFolderId, fetchTasks]);

  const addTask = async () => {
    if (!currentFolderId || !newTaskTitle.trim()) return;
    try {
      const { data } = await axios.post(`${BACKEND_URL}/folders/${currentFolderId}/tasks`, {
        userId,
        role,
        task: {
          title: newTaskTitle.trim(),
          checks: ["complete", "updated", "aligned with CHED standards"],
          percentage: 0,
          status: "not_started",
        },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
      setNewTaskTitle("");
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to create task");
    }
  };

  const addSuggestedTasks = async () => {
    if (!currentFolderId) return;
    const templates = TASK_TEMPLATE_SETS[templateKey] || [];
    if (!templates.length) return;
    try {
      setAddingTemplate(true);
      await Promise.all(
        templates.map((task) =>
          axios.post(`${BACKEND_URL}/folders/${currentFolderId}/tasks`, {
            userId,
            role,
            task: {
              ...task,
              checks: [
                "complete",
                "updated",
                "aligned with CHED standards",
                "compliance with CHED Memorandum Orders (CMOs)",
                "program outcomes alignment",
                "curriculum standards",
              ],
              percentage: 0,
              status: "not_started",
            },
          })
        )
      );
      await fetchTasks(currentFolderId);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to add suggested tasks");
    } finally {
      setAddingTemplate(false);
    }
  };

  const setTaskStatus = async (taskId, status) => {
    if (!currentFolderId || !taskId) return;
    try {
      const { data } = await axios.patch(`${BACKEND_URL}/folders/${currentFolderId}/tasks/${taskId}/check`, {
        userId,
        role,
        status,
        percentage: status === "complete" ? 100 : undefined,
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update task");
    }
  };

  const saveAssignments = async (nextAssignments) => {
    if (!currentFolderId) return;
    setAssignments(nextAssignments);
    try {
      await axios.put(`${BACKEND_URL}/folders/${currentFolderId}/tasks`, {
        userId,
        role,
        tasks: folderTasks,
        assignments: nextAssignments,
      });
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update assignments");
    }
  };

  const addAssignmentUser = (key, selectedId) => {
    if (!selectedId) return;
    const current = (assignments[key] || []).map((u) => String(u?._id || u));
    if (current.includes(selectedId)) return;
    saveAssignments({ ...assignments, [key]: [...current, selectedId] });
  };

  const removeAssignmentUser = (key, removeId) => {
    const current = (assignments[key] || []).map((u) => String(u?._id || u));
    saveAssignments({ ...assignments, [key]: current.filter((id) => id !== removeId) });
  };

  const renderTasks = (tasks = []) => (
    <ul className="list-group list-group-flush">
      {tasks.map((task) => (
        <li key={task._id} className="list-group-item px-0 border-0">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div className="small fw-semibold">{task.title}</div>
            <select
              className="form-select form-select-sm"
              style={{ width: "130px" }}
              value={task.status}
              onChange={(e) => setTaskStatus(task._id, e.target.value)}
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          {(task.children || []).length > 0 && <div className="ms-3 mt-1">{renderTasks(task.children)}</div>}
        </li>
      ))}
    </ul>
  );

  const renderRequiredTaskList = (tasks = []) => (
    <ul className="list-group list-group-flush">
      {tasks.map((task) => (
        <li key={task._id} className="list-group-item px-0 border-0 py-2">
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                border: Number(task.percentage || 0) >= 100 || task.status === "complete" ? "none" : "2px solid #c7c7c7",
                background: Number(task.percentage || 0) >= 100 || task.status === "complete" ? "#45be57" : "transparent",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(Number(task.percentage || 0) >= 100 || task.status === "complete") ? "✓" : ""}
            </div>
            <div className="small" style={{ color: "#555" }}>{task.title}</div>
          </div>
          {(task.children || []).length > 0 && <div className="ms-3 mt-1">{renderRequiredTaskList(task.children)}</div>}
        </li>
      ))}
    </ul>
  );

  const checklistStats = useMemo(() => {
    let total = 0;
    let completed = 0;
    const walk = (tasks = []) => {
      for (const task of tasks || []) {
        total += 1;
        if (Number(task?.percentage || 0) >= 100 || task?.status === "complete") completed += 1;
        walk(task?.children || []);
      }
    };
    walk(folderTasks || []);
    return { total, completed };
  }, [folderTasks]);

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

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const goInto = (folderId) => setCurrentFolderId(folderId);
  const goUp = () => {
    if (!breadcrumbs.length) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    setCurrentFolderId(parent ? parent._id : null);
  };

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Delete folder "${folder.name}" and its contents?`)) return;
    await axios.delete(`${BACKEND_URL}/folders/${folder._id}`, { params: { role, userId } });
    fetchOwnedContents(currentFolderId);
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Delete file "${file.originalName}"?`)) return;
    await axios.delete(`${BACKEND_URL}/files/${file._id}`, { params: { role, userId } });
    fetchOwnedContents(currentFolderId);
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, item });
  };

  const closeContextMenu = () => setContextMenu({ visible: false, item: null });

  const isOwnedByCurrentUser = useCallback((item) => {
    const ownerCandidate = item?.owner?._id || item?.owner || item?.ownerId;
    if (ownerCandidate && String(ownerCandidate) === String(userId)) return true;
    if (userEmail && item?.ownerEmail) {
      return String(item.ownerEmail).toLowerCase() === String(userEmail).toLowerCase();
    }
    return false;
  }, [userEmail, userId]);

  const searchFiles = searchResults?.filter((item) => item.type === "file") || [];
  const searchFolders = searchResults?.filter((item) => item.type === "folder") || [];
  const isSearchMode = Array.isArray(searchResults);
  const visibleFolders = (searchResults ? searchFolders : folders).filter(isOwnedByCurrentUser);
  const visibleFiles = (searchResults ? searchFiles : files).filter(isOwnedByCurrentUser);
  const filteredVisibleFolders = useMemo(() => {
    const query = String(folderQuery || "").trim().toLowerCase();
    if (!query) return visibleFolders;
    return visibleFolders.filter((f) => String(f?.name || "").toLowerCase().includes(query));
  }, [visibleFolders, folderQuery]);
  const filteredVisibleFiles = useMemo(() => {
    const query = String(folderQuery || "").trim().toLowerCase();
    if (!query) return visibleFiles;
    return visibleFiles.filter((f) => String(f?.originalName || "").toLowerCase().includes(query));
  }, [visibleFiles, folderQuery]);

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
    await fetchOwnedContents(currentFolderId);
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
      await fetchOwnedContents(currentFolderId);
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
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {currentFolderId && (
            <button className="btn btn-outline-secondary" onClick={goUp}>
              <FaArrowLeft className="me-1" /> Back
            </button>
          )}
          <div className="d-flex align-items-center flex-wrap overflow-auto">
            <span className="fw-bold me-2 text-primary">Admin Owned Workspace</span>
            {breadcrumbs.map((b) => (
              <span key={b._id || "root"} className="d-flex align-items-center">
                <FaChevronRight className="mx-2 text-muted" size={12} />
                <button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => setCurrentFolderId(b._id || null)}>
                  {b.name || "Root"}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-primary" onClick={() => setShowPresetModal(true)}>
            <FaPlus className="me-1" /> Predefined Folders
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <FaPlus className="me-1" /> New Folder
          </button>
          <button className="btn btn-success" onClick={() => setShowUpload(true)}>
            <FaUpload className="me-1" /> Add Files
          </button>
          <div className="btn-group" role="group">
            <button className={`btn ${view === "grid" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("grid")} title="Grid View">
              <FaTh />
            </button>
            <button className={`btn ${view === "list" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("list")} title="List View">
              <FaList />
            </button>
          </div>
        </div>
      </div>

      <div className="alert alert-light border py-2 px-3 small mb-3">
        Tip: Open a folder, then upload/share/rename documents. Drag and drop works for moving files and folders.
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <input
          className="form-control"
          style={{ maxWidth: "380px" }}
          placeholder="Search folders or files in current view"
          value={folderQuery}
          onChange={(e) => setFolderQuery(e.target.value)}
        />
        <div className="d-flex align-items-center gap-2">
          <span className="badge text-bg-light border">Folders: {visibleFolders.length}</span>
          <span className="badge text-bg-light border">Files: {visibleFiles.length}</span>
          {currentFolderId && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setCurrentFolderId(null)}>
              Go to Root
            </button>
          )}
        </div>
      </div>

      {view === "grid" ? (
        <div className="row g-4">
          {movingByDrop && (
            <div className="col-12">
              <div className="alert alert-info py-2 mb-0">Moving item...</div>
            </div>
          )}
          {filteredVisibleFolders.map((folder) => (
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
              onContextMenu={(e) => handleContextMenu(e, { type: "folder", data: folder })}
            >
              <div
                className="card folder-card h-100 text-center p-3 position-relative"
                onDragOver={(e) => handleFolderDragOver(e, folder._id)}
                onDrop={(e) => handleFolderDrop(e, folder._id)}
                onDragLeave={() => {
                  if (activeDropFolderId === String(folder._id)) setActiveDropFolderId("");
                }}
                style={activeDropFolderId === String(folder._id)
                  ? { border: "2px dashed #0d6efd", background: "rgba(13,110,253,0.08)" }
                  : undefined}
              >
                <div className="position-absolute top-0 end-0 p-2">
                  <button
                    className="btn btn-sm btn-light"
                    onClick={(e) => handleContextMenu(e, { type: "folder", data: folder })}
                    title="More actions"
                  >
                    <FaEllipsisV />
                  </button>
                </div>
                <FaFolder size={42} className="text-warning mb-3" />
                <h6 className="card-title text-truncate">{folder.name}</h6>
                {folder.isPredefinedRoot && <span className="badge bg-primary">Predefined Folder Tree</span>}
                <div
                  className="d-flex gap-1 justify-content-center mt-2 flex-nowrap"
                  style={{ overflowX: "auto", paddingBottom: "2px" }}
                >
                  <button className="btn btn-sm btn-outline-primary" onClick={() => goInto(folder._id)}>
                    <FaEye />
                  </button>
                  <button className="btn btn-sm btn-outline-info" onClick={() => setShareTarget({ type: "folder", item: folder })}>
                    <FaShareAlt />
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setRenameTarget({ type: "folder", data: folder })}>
                    <FaFileSignature />
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteFolder(folder)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredVisibleFiles.map((file) => (
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
              onContextMenu={(e) => handleContextMenu(e, { type: "file", data: file })}
            >
              <div className="card file-card h-100 text-center p-3 position-relative">
                <div className="position-absolute top-0 end-0 p-2">
                  <button
                    className="btn btn-sm btn-light"
                    onClick={(e) => handleContextMenu(e, { type: "file", data: file })}
                    title="More actions"
                  >
                    <FaEllipsisV />
                  </button>
                </div>
                <div className="mb-3">{iconByMime(file.mimetype)}</div>
                <h6 className="card-title text-truncate">{file.originalName}</h6>
                <p className="text-muted small">{formatFileSize(file.size)}</p>
                <div className="d-flex flex-wrap gap-1 justify-content-center">
                  <a className="btn btn-sm btn-outline-primary" href={`${BACKEND_URL}/preview/${file.filename}?role=${role}&userId=${userId}`} target="_blank" rel="noreferrer">
                    <FaEye />
                  </a>
                  <a className="btn btn-sm btn-outline-success" href={`${BACKEND_URL}/download/${file.filename}?role=${role}&userId=${userId}`}>
                    <FaCloudDownloadAlt />
                  </a>
                  <button className="btn btn-sm btn-outline-info" onClick={() => setShareTarget({ type: "file", item: file })}>
                    <FaShareAlt />
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setRenameTarget({ type: "file", data: file })}>
                    <FaFileSignature />
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteFile(file)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Modified</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisibleFolders.map((folder) => (
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
                  onContextMenu={(e) => handleContextMenu(e, { type: "folder", data: folder })}
                  style={activeDropFolderId === String(folder._id) ? { outline: "2px dashed #0d6efd", outlineOffset: "-2px" } : undefined}
                >
                  <td className="d-flex align-items-center">
                    <FaFolder className="text-warning me-2" />
                    {folder.name}
                    {folder.isPredefinedRoot && <span className="badge bg-primary ms-2">Predefined Folder Tree</span>}
                  </td>
                  <td>Folder</td>
                  <td>-</td>
                  <td>{new Date(folder.createdAt).toLocaleDateString()}</td>
                  <td className="text-center">
                    <div className="btn-group">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => goInto(folder._id)}>
                        <FaEye />
                      </button>
                      <button className="btn btn-sm btn-outline-info" onClick={() => setShareTarget({ type: "folder", item: folder })}>
                        <FaShareAlt />
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setRenameTarget({ type: "folder", data: folder })}>
                        <FaFileSignature />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteFolder(folder)}>
                        <FaTrash />
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={(e) => handleContextMenu(e, { type: "folder", data: folder })}>
                        <FaEllipsisV />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVisibleFiles.map((file) => (
                <tr
                  key={file._id}
                  draggable={canDragItem()}
                  onDragStart={(e) => handleDragStart(e, {
                    type: "file",
                    id: file._id,
                    fromFolderId: currentFolderId || "",
                  })}
                  onDragEnd={handleDragEnd}
                  onContextMenu={(e) => handleContextMenu(e, { type: "file", data: file })}
                >
                  <td className="d-flex align-items-center">{iconByMime(file.mimetype)} {file.originalName}</td>
                  <td>{file.mimetype.split("/")[1] || file.mimetype}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{new Date(file.uploadDate).toLocaleDateString()}</td>
                  <td className="text-center">
                    <div className="btn-group">
                      <a className="btn btn-sm btn-outline-primary" href={`${BACKEND_URL}/preview/${file.filename}?role=${role}&userId=${userId}`} target="_blank" rel="noreferrer">
                        <FaEye />
                      </a>
                      <a className="btn btn-sm btn-outline-success" href={`${BACKEND_URL}/download/${file.filename}?role=${role}&userId=${userId}`}>
                        <FaCloudDownloadAlt />
                      </a>
                      <button className="btn btn-sm btn-outline-info" onClick={() => setShareTarget({ type: "file", item: file })}>
                        <FaShareAlt />
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setRenameTarget({ type: "file", data: file })}>
                        <FaFileSignature />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteFile(file)}>
                        <FaTrash />
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={(e) => handleContextMenu(e, { type: "file", data: file })}>
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

      {filteredVisibleFolders.length === 0 && filteredVisibleFiles.length === 0 && (
        <div className="text-center py-5">
          <FaFolder className="text-muted mb-3" size={48} />
          <h5 className="text-muted">
            {folderQuery ? "No folders or files match your search" : "No admin-owned files or folders yet"}
          </h5>
        </div>
      )}

      {showPresetModal && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Predefined Folders</h5>
                <button type="button" className="btn-close" onClick={() => setShowPresetModal(false)}></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Template Set</label>
                <select className="form-select mb-3" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                  <option value="copc_bsit">COPC BSIT Structure</option>
                  <option value="academic">Academic Operations</option>
                  <option value="operations">Business Operations</option>
                </select>
                <div className="small text-muted mb-2">
                  Folders to create in <strong>{currentFolderId ? "current folder" : "root"}</strong>:
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {(PREDEFINED_FOLDER_SETS[presetKey] || []).map((name) => (
                    <span className="badge bg-light text-dark border" key={name}>{name}</span>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowPresetModal(false)} disabled={creatingPreset}>Cancel</button>
                <button className="btn btn-primary" onClick={createPredefinedFolders} disabled={creatingPreset}>
                  {creatingPreset ? "Creating..." : "Create Folders"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <>
          <div className="modal-backdrop fade show"></div>
          <CreateFolderModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              fetchOwnedContents(currentFolderId);
            }}
            parentFolder={currentFolderId}
          />
        </>
      )}
      {showUpload && (
        <>
          <div className="modal-backdrop fade show"></div>
          <UploadModal
            onClose={() => setShowUpload(false)}
            onUploaded={() => {
              setShowUpload(false);
              fetchOwnedContents(currentFolderId);
            }}
            parentFolder={currentFolderId}
          />
        </>
      )}
      {contextMenu.visible && contextMenu.item && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {contextMenu.item.type === "folder" ? contextMenu.item.data.name : contextMenu.item.data.originalName}
                </h5>
                <button type="button" className="btn-close" onClick={closeContextMenu}></button>
              </div>
              <div className="modal-body">
                <div className="d-grid gap-2">
                  {contextMenu.item.type === "folder" ? (
                    <>
                      <button className="btn btn-outline-primary d-flex align-items-center" onClick={() => { goInto(contextMenu.item.data._id); closeContextMenu(); }}>
                        <FaEye className="me-2" /> Open Folder
                      </button>
                      <button className="btn btn-outline-info d-flex align-items-center" onClick={() => { setShareTarget({ type: "folder", item: contextMenu.item.data }); closeContextMenu(); }}>
                        <FaShareAlt className="me-2" /> Share
                      </button>
                      <button className="btn btn-outline-secondary d-flex align-items-center" onClick={() => { setRenameTarget({ type: "folder", data: contextMenu.item.data }); closeContextMenu(); }}>
                        <FaFileSignature className="me-2" /> Rename
                      </button>
                      <button className="btn btn-outline-danger d-flex align-items-center" onClick={() => { deleteFolder(contextMenu.item.data); closeContextMenu(); }}>
                        <FaTrash className="me-2" /> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <a className="btn btn-outline-primary d-flex align-items-center" href={`${BACKEND_URL}/preview/${contextMenu.item.data.filename}?role=${role}&userId=${userId}`} target="_blank" rel="noreferrer" onClick={closeContextMenu}>
                        <FaEye className="me-2" /> Preview
                      </a>
                      <a className="btn btn-outline-success d-flex align-items-center" href={`${BACKEND_URL}/download/${contextMenu.item.data.filename}?role=${role}&userId=${userId}`} onClick={closeContextMenu}>
                        <FaCloudDownloadAlt className="me-2" /> Download
                      </a>
                      <button className="btn btn-outline-info d-flex align-items-center" onClick={() => { setShareTarget({ type: "file", item: contextMenu.item.data }); closeContextMenu(); }}>
                        <FaShareAlt className="me-2" /> Share
                      </button>
                      <button className="btn btn-outline-secondary d-flex align-items-center" onClick={() => { setRenameTarget({ type: "file", data: contextMenu.item.data }); closeContextMenu(); }}>
                        <FaFileSignature className="me-2" /> Rename
                      </button>
                      <button className="btn btn-outline-danger d-flex align-items-center" onClick={() => { deleteFile(contextMenu.item.data); closeContextMenu(); }}>
                        <FaTrash className="me-2" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeContextMenu}>Close</button>
              </div>
            </div>
          </div>
        </div>
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
      {renameTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <RenameModal
            item={renameTarget}
            onClose={() => setRenameTarget(null)}
            onRenamed={() => {
              setRenameTarget(null);
              fetchOwnedContents(currentFolderId);
            }}
          />
        </>
      )}

      {currentFolderId && isAdmin && (
        <div className="card shadow-sm mt-3" style={{ maxWidth: "460px" }}>
          <div className="card-header bg-light py-2">
            <div className="d-flex justify-content-between align-items-center">
              <div className="fw-semibold small" style={{ color: "#555" }}>Task Checklist</div>
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">{checklistStats.completed}/{checklistStats.total}</span>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setIsChecklistCollapsed((v) => !v)}
                  title={isChecklistCollapsed ? "Expand checklist" : "Collapse checklist"}
                >
                  {isChecklistCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                </button>
              </div>
            </div>
            <div className="progress mt-2" style={{ height: "10px", background: "#d9dce0" }}>
              <div className="progress-bar" style={{ width: `${Math.max(0, Math.min(100, taskProgress))}%`, background: "#45be57" }} />
            </div>
          </div>
          {!isChecklistCollapsed && (
            <div className="card-body py-2" style={{ maxHeight: "240px", overflowY: "auto" }}>
              <div className="small fw-semibold mb-2">Required Tasks In This Folder</div>
              {folderTasks.length ? renderRequiredTaskList(folderTasks) : (
                <div className="small text-muted">No required tasks yet.</div>
              )}
              <button
                className="btn btn-sm btn-outline-primary mt-2"
                onClick={() => navigate(`/admin/tasks?folderId=${encodeURIComponent(currentFolderId)}`)}
              >
                Open Task Management Page
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

