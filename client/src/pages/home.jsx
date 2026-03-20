import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

import { FaFileSignature } from "react-icons/fa"; // âœ… new icon for Rename
import RenameModal from "../components/RenameModal.jsx"; // âœ… new modal component

import CreateFolderModal from "../components/CreateFolderModal.jsx";
import MoveModal from "../components/MoveModal";
import ShareModal from "../components/ShareModal";
import ManageSharesModal from "../components/ManageSharesModal";
import UploadModal from "../components/UploadModal";
import VersionModal from "../components/VersionModal.jsx";
import CommentsModal from "../components/CommentsModal.jsx";
import { useOutletContext, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";
import { isExternalFileDrag, uploadDroppedEntries } from "../utils/dropUpload";

export default function Home() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "faculty";
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
  const isProgramChair = normalizeRole(role) === "dept_chair";
  const isQaReviewer = normalizeRole(role) === "qa_admin";
  const isFaculty = normalizeRole(role) === "faculty";
  const canUploadByRole = ["superadmin", "qa_admin", "dept_chair", "faculty"].includes(normalizeRole(role));
  const canDeleteByRole = ["superadmin", "qa_admin"].includes(normalizeRole(role));
  const canCheckTasks = isAdmin || isProgramChair || isQaReviewer;
  const LEGACY_TASK_STATUS_MAP = { not_started: "pending", complete: "approved" };
  const normalizeTaskStatusValue = (value) => {
    const key = String(value || "").toLowerCase();
    return LEGACY_TASK_STATUS_MAP[key] || key || "pending";
  };
  const isTaskDone = (task) =>
    normalizeTaskStatusValue(task?.status) === "approved" || Number(task?.percentage || 0) >= 100;
  const isAssignedReviewer = (file, stage) => {
    if (isAdmin) return true;
    const workflow = file?.reviewWorkflow || {};
    const list =
      stage === "program_chair"
        ? workflow.assignedProgramChairs || []
        : workflow.assignedQaOfficers || [];
    if (!Array.isArray(list) || list.length === 0) return false;
    return list.some((entry) => String(entry?._id || entry) === String(userId));
  };

  const [renameTarget, setRenameTarget] = useState(null); // âœ… for rename modal

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
  const [dragPayload, setDragPayload] = useState(null);
  const [activeDropFolderId, setActiveDropFolderId] = useState("");
  const [movingByDrop, setMovingByDrop] = useState(false);
  const [externalDropActive, setExternalDropActive] = useState(false);
  const [uploadingDroppedItems, setUploadingDroppedItems] = useState(false);
  const [dropUploadMessage, setDropUploadMessage] = useState("");
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    item: null,
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [users, setUsers] = useState([]);
  const [folderTasks, setFolderTasks] = useState([]);
  const [taskProgress, setTaskProgress] = useState(0);
  const [folderAssignments, setFolderAssignments] = useState({
    uploaders: [],
    programChairs: [],
    qaOfficers: [],
  });
  const [folderReviews, setFolderReviews] = useState({ programChair: [], qa: [] });
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(false);
  const [isCurrentFolderCopcScoped, setIsCurrentFolderCopcScoped] = useState(false);
  const [dashboardRows, setDashboardRows] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [canUploadCurrentFolder, setCanUploadCurrentFolder] = useState(true);
  const [documentRequests, setDocumentRequests] = useState([]);
  const [facultyCompleteness, setFacultyCompleteness] = useState({ percent: 0, requirements: [] });
  const { searchResults } = useOutletContext();
  const navigate = useNavigate();
  const CHECKLIST_PANEL_WIDTH = 360;
  const CHECKLIST_PANEL_TOP = 92;
  const CHECKLIST_PANEL_RIGHT = 18;
  const CHECKLIST_BOUNDARY_PADDING = 8;
  const checklistCardRef = useRef(null);
  const checklistDragOffsetRef = useRef({ x: 0, y: 0 });
  const checklistDraggingRef = useRef(false);
  const [checklistPosition, setChecklistPosition] = useState({ x: null, y: null });
  const [isChecklistDragging, setIsChecklistDragging] = useState(false);

  // âœ… Pagination state
  const [itemsToShow, setItemsToShow] = useState(12);

  const getDefaultChecklistPosition = useCallback(() => {
    if (typeof window === "undefined") return { x: 0, y: CHECKLIST_PANEL_TOP };
    return {
      x: Math.max(
        CHECKLIST_BOUNDARY_PADDING,
        window.innerWidth - CHECKLIST_PANEL_WIDTH - CHECKLIST_PANEL_RIGHT
      ),
      y: CHECKLIST_PANEL_TOP,
    };
  }, []);

  const clampChecklistPosition = useCallback((x, y) => {
    if (typeof window === "undefined") return { x, y };
    const panelWidth = checklistCardRef.current?.offsetWidth || CHECKLIST_PANEL_WIDTH;
    const panelHeight = checklistCardRef.current?.offsetHeight || 280;
    const maxX = Math.max(
      CHECKLIST_BOUNDARY_PADDING,
      window.innerWidth - panelWidth - CHECKLIST_BOUNDARY_PADDING
    );
    const maxY = Math.max(
      CHECKLIST_BOUNDARY_PADDING,
      window.innerHeight - panelHeight - CHECKLIST_BOUNDARY_PADDING
    );
    return {
      x: Math.min(Math.max(CHECKLIST_BOUNDARY_PADDING, x), maxX),
      y: Math.min(Math.max(CHECKLIST_BOUNDARY_PADDING, y), maxY),
    };
  }, []);

  const beginChecklistDrag = useCallback((event) => {
    if (typeof window === "undefined" || window.innerWidth < 1200) return;
    const cardRect = checklistCardRef.current?.getBoundingClientRect();
    const fallback = getDefaultChecklistPosition();
    const originX = cardRect?.left ?? (Number.isFinite(checklistPosition.x) ? checklistPosition.x : fallback.x);
    const originY = cardRect?.top ?? (Number.isFinite(checklistPosition.y) ? checklistPosition.y : fallback.y);
    checklistDragOffsetRef.current = {
      x: event.clientX - originX,
      y: event.clientY - originY,
    };
    checklistDraggingRef.current = true;
    setIsChecklistDragging(true);
    event.preventDefault();
  }, [checklistPosition.x, checklistPosition.y, getDefaultChecklistPosition]);

  // Reset pagination when folder or search changes
  useEffect(() => {
    setItemsToShow(12);
  }, [currentFolder, searchResults]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!checklistDraggingRef.current) return;
      const nextX = event.clientX - checklistDragOffsetRef.current.x;
      const nextY = event.clientY - checklistDragOffsetRef.current.y;
      setChecklistPosition(clampChecklistPosition(nextX, nextY));
    };
    const stopChecklistDrag = () => {
      if (!checklistDraggingRef.current) return;
      checklistDraggingRef.current = false;
      setIsChecklistDragging(false);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopChecklistDrag);
    window.addEventListener("pointercancel", stopChecklistDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopChecklistDrag);
      window.removeEventListener("pointercancel", stopChecklistDrag);
    };
  }, [clampChecklistPosition]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 1200) return;
    setChecklistPosition((prev) => {
      if (Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
        return clampChecklistPosition(prev.x, prev.y);
      }
      const defaults = getDefaultChecklistPosition();
      return clampChecklistPosition(defaults.x, defaults.y);
    });
  }, [canCheckTasks, currentFolder, clampChecklistPosition, getDefaultChecklistPosition]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) return;
      setChecklistPosition((prev) => {
        const base = Number.isFinite(prev.x) && Number.isFinite(prev.y)
          ? prev
          : getDefaultChecklistPosition();
        return clampChecklistPosition(base.x, base.y);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampChecklistPosition, getDefaultChecklistPosition]);

  useEffect(() => {
    if (!isChecklistDragging) return undefined;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isChecklistDragging]);

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
    setFolders(Array.isArray(fdrRes.data) ? fdrRes.data : []);
    setFiles(Array.isArray(filRes.data) ? filRes.data : []);
    setBreadcrumbs(Array.isArray(bcRes.data) ? bcRes.data : []);
  }, [userId, role]);

  useEffect(() => {
    fetchFolderContents(currentFolder).catch(console.error);
  }, [fetchFolderContents, currentFolder]);

  useEffect(() => {
    axios.post(`${BACKEND_URL}/notifications/smart/${userId}`).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!canCheckTasks && !isAdmin) return;
    axios.get(`${BACKEND_URL}/users`, { params: { role } })
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]));
  }, [canCheckTasks, isAdmin, role]);

  const collectAssignedUploaders = useCallback((tasks = [], output = new Set()) => {
    for (const task of tasks || []) {
      (task.assignedUploaders || []).forEach((u) => {
        const id = u?._id || u;
        if (id) output.add(String(id));
      });
      const assignedRole = String(task?.assignedRole || "").toLowerCase();
      if (assignedRole === "faculty" && task?.assignedTo) {
        const assignedToId = task.assignedTo?._id || task.assignedTo;
        if (assignedToId) output.add(String(assignedToId));
      }
      collectAssignedUploaders(task.children || [], output);
    }
    return output;
  }, []);

  const fetchFolderTasks = useCallback(async (folderId) => {
    if (!folderId) {
      setFolderTasks([]);
      setTaskProgress(0);
      setFolderAssignments({ uploaders: [], programChairs: [], qaOfficers: [] });
      setIsCurrentFolderCopcScoped(false);
      setCanUploadCurrentFolder(canUploadByRole);
      return;
    }
    setIsCurrentFolderCopcScoped(false);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/folders/${folderId}/tasks`, {
        params: { userId, role },
      });
      const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
      const assignments = data?.assignments || { uploaders: [], programChairs: [], qaOfficers: [] };
      const hasCopcProfile = String(data?.profileKey || "").toUpperCase().startsWith("COPC_");
      const isCopcScoped = Boolean(data?.isCopcScoped) || hasCopcProfile;
      setFolderTasks(tasks);
      setTaskProgress(Number(data?.progress || 0));
      setFolderAssignments(assignments);
      setFolderReviews(data?.reviews || { programChair: [], qa: [] });
      setIsCurrentFolderCopcScoped(isCopcScoped);

      const assignedUploaders = new Set();
      collectAssignedUploaders(tasks).forEach((id) => assignedUploaders.add(id));
      const hasComplianceScope = tasks.length > 0 || !!data?.profileKey;
      if (!isFaculty) {
        setCanUploadCurrentFolder(canUploadByRole);
      } else if (!hasComplianceScope) {
        setCanUploadCurrentFolder(canUploadByRole);
      } else {
        setCanUploadCurrentFolder(canUploadByRole && assignedUploaders.has(String(userId)));
      }
    } catch {
      setFolderTasks([]);
      setTaskProgress(0);
      setFolderAssignments({ uploaders: [], programChairs: [], qaOfficers: [] });
      setIsCurrentFolderCopcScoped(false);
      setCanUploadCurrentFolder(canUploadByRole);
    }
  }, [collectAssignedUploaders, canUploadByRole, isFaculty, role, userId]);

  useEffect(() => {
    fetchFolderTasks(currentFolder);
  }, [currentFolder, fetchFolderTasks]);

  useEffect(() => {
    if (!canCheckTasks) return;
    axios.get(`${BACKEND_URL}/compliance/dashboard`, {
      params: { userId, role, profile: "COPC_BSIT" },
    })
      .then((res) => setDashboardRows(Array.isArray(res.data?.summary) ? res.data.summary : []))
      .catch(() => setDashboardRows([]));
  }, [canCheckTasks, role, userId, currentFolder]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/document-requests`, { params: { userId } })
      .then((res) => setDocumentRequests(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDocumentRequests([]));
  }, [userId]);

  useEffect(() => {
    if (!currentFolder) return;
    axios.post(`${BACKEND_URL}/folders/${currentFolder}/completeness`, {
      requiredDocuments: ["TOR", "Diploma", "PRC License", "Curriculum Vitae"],
    })
      .then((res) => setFacultyCompleteness(res.data || { percent: 0, requirements: [] }))
      .catch(() => setFacultyCompleteness({ percent: 0, requirements: [] }));
  }, [currentFolder, files]);

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
    const breadcrumbList = Array.isArray(breadcrumbs) ? breadcrumbs : [];
    if (!breadcrumbList.length) return;
    const parent = breadcrumbList[breadcrumbList.length - 2];
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

  const normalizePermission = (permission) => {
    if (permission === "owner") return "owner";
    if (permission === "editor" || permission === "write") return "editor";
    return "viewer";
  };

  const getItemPermission = (item) => {
    if (!item?.isShared) return "owner";
    return normalizePermission(item.permission || item.permissions);
  };

  const isSharedEditor = (item) => item?.isShared && getItemPermission(item) === "editor";
  const canEditItem = (item) => !item?.isShared || isSharedEditor(item);
  const isSearchMode = Array.isArray(searchResults);
  const canDragItem = (item) => {
    if (isSearchMode) return false;
    if (isAdmin) return true;
    return !item?.isShared;
  };

  const moveDraggedItem = useCallback(async (payload, destinationFolderId) => {
    if (!payload?.id || !destinationFolderId) return;
    const sourceFolderId = payload.fromFolderId || "";
    if (String(sourceFolderId) === String(destinationFolderId)) return;

    const endpoint = payload.type === "file"
      ? `${BACKEND_URL}/files/${payload.id}/move`
      : `${BACKEND_URL}/folders/${payload.id}/move`;

    await axios.patch(endpoint, {
      newFolderId: destinationFolderId,
      userId,
      role,
    });

    await fetchFolderContents(currentFolder);
    if (currentFolder) {
      fetchFolderTasks(currentFolder).catch(() => {});
    }
  }, [currentFolder, fetchFolderContents, fetchFolderTasks, role, userId]);

  const handleDragStart = (event, payload) => {
    if (!payload || !canDragItem({ isShared: payload.isShared })) return;
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

  const uploadFromDropDataTransfer = useCallback(async (dataTransfer, destinationFolderId = currentFolder || null) => {
    if (!canUploadByRole) {
      alert("Your role is not allowed to upload.");
      return false;
    }
    if (isSearchMode) {
      alert("Exit search mode before dropping files or folders.");
      return false;
    }
    if (currentFolder && String(destinationFolderId || "") === String(currentFolder) && !canUploadCurrentFolder) {
      alert("You are not assigned to upload in this folder.");
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
      await fetchFolderContents(currentFolder);
      if (currentFolder) {
        await fetchFolderTasks(currentFolder);
      }
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
  }, [
    canUploadByRole,
    isSearchMode,
    currentFolder,
    canUploadCurrentFolder,
    userId,
    role,
    fetchFolderContents,
    fetchFolderTasks,
  ]);

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
    await uploadFromDropDataTransfer(event.dataTransfer, currentFolder || null);
  };

  useEffect(() => {
    if (!dropUploadMessage || uploadingDroppedItems) return;
    const timer = setTimeout(() => setDropUploadMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [dropUploadMessage, uploadingDroppedItems]);

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

  // âœ… Use search results if available, otherwise normal data
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

  // âœ… Paginated arrays
  const paginatedFolders = visibleFolders.slice(0, itemsToShow);
  const paginatedFiles = visibleFiles.slice(0, itemsToShow);

  const handleLoadMore = () => {
    setItemsToShow((prev) => prev + 15);
  };

  const upsertTaskTree = async (nextTasks, nextAssignments = folderAssignments) => {
    if (!currentFolder) return;
    const { data } = await axios.put(`${BACKEND_URL}/folders/${currentFolder}/tasks`, {
      userId,
      role,
      tasks: nextTasks,
      assignments: nextAssignments,
      profileKey: "COPC_BSIT",
    });
    setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    setTaskProgress(Number(data?.progress || 0));
    setFolderAssignments(data?.assignments || nextAssignments);
  };

  const createRootTask = async () => {
    if (!isAdmin || !currentFolder || !newTaskTitle.trim()) return;
    try {
      const { data } = await axios.post(`${BACKEND_URL}/folders/${currentFolder}/tasks`, {
        userId,
        role,
        task: {
          title: newTaskTitle.trim(),
          checks: ["complete", "updated", "aligned with CHED standards"],
          scope: "General",
          percentage: 0,
          status: "pending",
        },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
      setNewTaskTitle("");
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to create task");
    }
  };

  const updateTask = async (taskId, updates) => {
    if (!currentFolder || !taskId) return;
    const nextUpdates = { ...(updates || {}) };
    if (Object.prototype.hasOwnProperty.call(nextUpdates, "status")) {
      nextUpdates.status = normalizeTaskStatusValue(nextUpdates.status);
      if (nextUpdates.status === "rejected" && !nextUpdates.comment && !nextUpdates.notes) {
        const promptValue = window.prompt("Add rejection comment:", "");
        if (promptValue === null) return;
        const note = String(promptValue || "").trim();
        if (!note) {
          alert("Rejection comment is required.");
          return;
        }
        nextUpdates.comment = note;
        nextUpdates.notes = note;
      }
    }
    const endpoint = isAdmin
      ? `${BACKEND_URL}/folders/${currentFolder}/tasks/${taskId}`
      : `${BACKEND_URL}/folders/${currentFolder}/tasks/${taskId}/check`;
    const payload = isAdmin ? { userId, role, updates: nextUpdates } : { userId, role, ...nextUpdates };
    try {
      const { data } = await axios.patch(endpoint, payload);
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update task");
    }
  };

  const submitFolderReview = async (scope, checks) => {
    if (!currentFolder || !canCheckTasks) return;
    try {
      await axios.post(`${BACKEND_URL}/folders/${currentFolder}/reviews`, {
        userId,
        role,
        scope,
        checks,
        notes: "",
      });
      fetchFolderTasks(currentFolder);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to submit review");
    }
  };

  const handleFileStageReview = async (file, stage, action) => {
    if (!file?._id) return;
    try {
      const endpoint = stage === "program_chair"
        ? `${BACKEND_URL}/files/${file._id}/review/program-chair`
        : `${BACKEND_URL}/files/${file._id}/review/qa`;
      await axios.patch(endpoint, { userId, role, action, notes: "" });
      fetchFolderContents(currentFolder).catch(console.error);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to review file");
    }
  };

  const sendDocumentRequest = async () => {
    if (!isAdmin || !currentFolder) return;
    const target = window.prompt("Enter faculty user ID to request document from:");
    if (!target) return;
    const docName = window.prompt("Document name (e.g., PRC License):", "PRC License");
    if (!docName) return;
    const deadline = window.prompt("Deadline (YYYY-MM-DD):", "");
    try {
      await axios.post(`${BACKEND_URL}/folders/${currentFolder}/document-requests`, {
        userId,
        role,
        targetUserId: target,
        documentName: docName,
        deadline: deadline || undefined,
        message: `Upload your ${docName}`,
      });
      alert("Document request sent.");
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to send request");
    }
  };

  const renderTaskTree = (tasks = []) => (
    <ul className="list-group list-group-flush">
      {tasks.map((task) => (
        <li key={task._id} className="list-group-item px-0 border-0">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <div>
              <div className="fw-semibold small">{task.title}</div>
              <div className="text-muted" style={{ fontSize: "12px" }}>
                {task.scope || "General"} â€¢ {Number(task.percentage || 0)}%
              </div>
            </div>
            {canCheckTasks && (
              <select
                className="form-select form-select-sm"
                style={{ width: "130px" }}
                value={normalizeTaskStatusValue(task.status)}
                onChange={(e) => updateTask(task._id, {
                  status: e.target.value,
                })}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="for_review">For Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            )}
          </div>
          {isAdmin && (
            <div className="d-flex gap-1 mt-1">
              <button
                className="btn btn-sm btn-outline-secondary py-0"
                onClick={() => {
                  const nextTitle = window.prompt("Rename task", task.title);
                  if (nextTitle && nextTitle.trim()) updateTask(task._id, { title: nextTitle.trim() });
                }}
              >
                Rename
              </button>
              <button
                className="btn btn-sm btn-outline-secondary py-0"
                onClick={() => {
                  const nextScope = window.prompt("Scope", task.scope || "");
                  if (nextScope !== null) updateTask(task._id, { scope: nextScope });
                }}
              >
                Scope
              </button>
            </div>
          )}
          {(task.children || []).length > 0 && (
            <div className="ms-3 mt-1">{renderTaskTree(task.children)}</div>
          )}
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
                border: isTaskDone(task) ? "none" : "2px solid #c7c7c7",
                background: isTaskDone(task) ? "#45be57" : "transparent",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {isTaskDone(task) ? "v" : ""}
            </div>
            <div className="small" style={{ color: "#555" }}>
              {task.title}
            </div>
          </div>
          {(task.children || []).length > 0 && (
            <div className="ms-3 mt-1">{renderRequiredTaskList(task.children)}</div>
          )}
        </li>
      ))}
    </ul>
  );

  const shouldFloatChecklist = typeof window !== "undefined" && window.innerWidth >= 1200;
  const defaultChecklistPosition = shouldFloatChecklist ? getDefaultChecklistPosition() : { x: 0, y: 0 };
  const checklistLeft = Number.isFinite(checklistPosition.x) ? checklistPosition.x : defaultChecklistPosition.x;
  const checklistTop = Number.isFinite(checklistPosition.y) ? checklistPosition.y : defaultChecklistPosition.y;

  return (
    <>
      <div
        className="page-container"
        style={currentFolder && canCheckTasks && isCurrentFolderCopcScoped && shouldFloatChecklist ? { paddingRight: "390px" } : undefined}
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
                  {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 &&
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
                disabled={!canUploadByRole || !canUploadCurrentFolder}
                title={!canUploadCurrentFolder ? "You are not assigned to create folders in this folder" : "New Folder"}
              >
                <FaPlus className="me-1" /> New Folder
              </button>
              <button
                className="btn btn-success"
                onClick={() => setShowUpload(true)}
                disabled={!canUploadCurrentFolder}
                title={!canUploadCurrentFolder ? "You are not assigned to upload in this folder" : "Upload"}
              >
                <FaUpload className="me-1" /> Upload
              </button>
            </div>
          </div>
        </div>

        {documentRequests.length > 0 && (
          <div className="alert alert-warning py-2 mb-3">
            <strong>Pending Document Requests</strong>
            <ul className="mb-0 mt-1">
              {documentRequests.slice(0, 3).map((req) => (
                <li key={req._id}>
                  {req.message} {req.details ? `(${req.details})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

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
        {movingByDrop && (
          <div className="alert alert-info py-2">Moving item...</div>
        )}

        {/* âœ… Grid & List Views (use paginated arrays) */}
        {view === "grid" ? (
          <div className="row g-3 documents-spotlight-grid">
            {/* Folders */}
            {paginatedFolders.map((folder) => (
              <div
                key={folder._id}
                className="col-6 col-sm-4 col-md-3 col-xl-2"
                draggable={canDragItem(folder)}
                onDragStart={(e) => handleDragStart(e, {
                  type: "folder",
                  id: folder._id,
                  fromFolderId: currentFolder || "",
                  isShared: !!folder.isShared,
                })}
                onDragEnd={handleDragEnd}
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
                  onDragOver={(e) => handleFolderDragOver(e, folder._id)}
                  onDrop={(e) => handleFolderDrop(e, folder._id)}
                  onDragLeave={() => {
                    if (activeDropFolderId === String(folder._id)) setActiveDropFolderId("");
                  }}
                  style={activeDropFolderId === String(folder._id)
                    ? { border: "2px dashed #0d6efd", background: "rgba(13,110,253,0.08)" }
                    : undefined}
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
                      {!folder.isShared && (
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
                      )}
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
                draggable={canDragItem(file)}
                onDragStart={(e) => handleDragStart(e, {
                  type: "file",
                  id: file._id,
                  fromFolderId: currentFolder || "",
                  isShared: !!file.isShared,
                })}
                onDragEnd={handleDragEnd}
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
                      {!file.isShared && (
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
                      )}
                      {!file.isShared && (
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
                      )}
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
                      {isEditableFile(file) && canEditItem(file) && (
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
                      {!file.isShared && (
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
                      )}
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
                      draggable={canDragItem(folder)}
                      onDragStart={(e) => handleDragStart(e, {
                        type: "folder",
                        id: folder._id,
                        fromFolderId: currentFolder || "",
                        isShared: !!folder.isShared,
                      })}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleFolderDragOver(e, folder._id)}
                      onDrop={(e) => handleFolderDrop(e, folder._id)}
                      onDragLeave={() => {
                        if (activeDropFolderId === String(folder._id)) setActiveDropFolderId("");
                      }}
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
                      style={activeDropFolderId === String(folder._id) ? { outline: "2px dashed #0d6efd", outlineOffset: "-2px" } : undefined}
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
                      <td>â€”</td>
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
                          {!folder.isShared && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setVersionTarget({ type: "folder", item: folder })
                              }
                              title="Version History"
                            >
                              <FaHistory />
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setCommentsTarget({ type: "folder", item: folder })
                            }
                            title="Comments"
                          >
                            <FaComment />
                          </button>
                          {!folder.isShared && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setMoveTarget({ type: "folder", item: folder })
                              }
                              title="Move"
                            >
                              <FaArrowsAlt />
                            </button>
                          )}
                          {!folder.isShared && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setShareTarget({ type: "folder", item: folder })
                              }
                              title="Share"
                            >
                              <FaShareAlt />
                            </button>
                          )}
                          {!folder.isShared && canDeleteByRole && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => deleteFolder(folder)}
                              title="Delete"
                            >
                              <FaTrash />
                            </button>
                          )}
                          {canEditItem(folder) && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setRenameTarget({ type: "folder", data: folder })
                              }
                              title="Rename"
                            >
                              <FaFileSignature />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedFiles.map((file) => (
                    <tr
                      key={file._id}
                      draggable={canDragItem(file)}
                      onDragStart={(e) => handleDragStart(e, {
                        type: "file",
                        id: file._id,
                        fromFolderId: currentFolder || "",
                        isShared: !!file.isShared,
                      })}
                      onDragEnd={handleDragEnd}
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
                          {!file.isShared && (
                            <button
                              className={`btn btn-sm ${file.isFavorite ? "btn-warning" : "btn-outline-warning"}`}
                              onClick={() => toggleFavorite(file)}
                              title={file.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              {file.isFavorite ? <FaStar /> : <FaRegStar />}
                            </button>
                          )}
                          {!file.isShared && (
                            <button
                              className={`btn btn-sm ${file.isPinned ? "btn-dark" : "btn-outline-dark"}`}
                              onClick={() => togglePinned(file)}
                              title={file.isPinned ? "Unpin" : "Pin Document"}
                            >
                              <FaThumbtack />
                            </button>
                          )}
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
                          {isEditableFile(file) && canEditItem(file) && (
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
                          {!file.isShared && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setVersionTarget({ type: "file", item: file })
                              }
                              title="Version History"
                            >
                              <FaHistory />
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              setCommentsTarget({ type: "file", item: file })
                            }
                            title="Comments"
                          >
                            <FaComment />
                          </button>
                          {!file.isShared && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setMoveTarget({ type: "file", item: file })
                              }
                              title="Move"
                            >
                              <FaArrowsAlt />
                            </button>
                          )}
                          {!file.isShared && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setShareTarget({ type: "file", item: file })
                              }
                              title="Share"
                            >
                              <FaShareAlt />
                            </button>
                          )}
                          {!file.isShared && canDeleteByRole && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => deleteFile(file)}
                              title="Delete"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* âœ… Load More */}
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
              disabled={!canUploadCurrentFolder}
            >
              <FaUpload className="me-1" /> Upload Files
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => setShowCreate(true)}
              disabled={!canUploadByRole || !canUploadCurrentFolder}
            >
              <FaPlus className="me-1" /> New Folder
            </button>
          </div>
        )}

        {currentFolder && canCheckTasks && isCurrentFolderCopcScoped && (
          <div
            ref={checklistCardRef}
            className="card shadow-sm"
            style={shouldFloatChecklist
              ? {
                  position: "fixed",
                  left: checklistLeft,
                  top: checklistTop,
                  width: "360px",
                  maxHeight: "82vh",
                  overflowY: "auto",
                  zIndex: 9,
                }
              : { marginTop: "12px" }}
          >
            <div className="card-header bg-light">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  {shouldFloatChecklist && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-0 px-2"
                      onPointerDown={beginChecklistDrag}
                      title="Drag checklist"
                      aria-label="Drag checklist"
                      style={{ cursor: isChecklistDragging ? "grabbing" : "grab" }}
                    >
                      <FaArrowsAlt />
                    </button>
                  )}
                  <div className="fw-semibold" style={{ color: "#555" }}>Task Checklist</div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div style={{ fontWeight: 600, color: "#555" }}>{Math.round(taskProgress)}%</div>
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
              <div className="card-body">
                <div className="small fw-semibold mb-2">Required Tasks In This Folder</div>
                {folderTasks.length ? renderRequiredTaskList(folderTasks) : (
                  <div className="small text-muted">No required tasks yet.</div>
                )}
                {isAdmin && (
                  <button
                    className="btn btn-sm btn-outline-primary mt-2"
                    onClick={() =>
                      navigate(`/admin/copc-dashboard?tab=tasks&folderId=${encodeURIComponent(currentFolder)}`)
                    }
                  >
                    Open Task Management Page
                  </button>
                )}
              </div>
            )}
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
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {canEditItem(contextMenu.item.data) && (
                          <>
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
                          </>
                        )}
                        {!contextMenu.item.data.isShared && canDeleteByRole && (
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
                        )}
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
                        {isEditableFile(contextMenu.item.data) && canEditItem(contextMenu.item.data) && (
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
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
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
                        )}
                        {!contextMenu.item.data.isShared && (
                          <>
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
                          </>
                        )}
                        {!contextMenu.item.data.isShared && canDeleteByRole && (
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
                        )}
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
              onUploaded={() => fetchFolderContents(currentFolder).catch(console.error)}
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
        {/* âœ… Rename Modal */}
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


