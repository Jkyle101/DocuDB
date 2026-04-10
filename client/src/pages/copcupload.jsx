import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  FaArrowLeft,
  FaPlus,
  FaCheckSquare,
  FaChevronDown,
  FaChevronRight,
  FaChevronUp,
  FaCloudDownloadAlt,
  FaEye,
  FaFileAlt,
  FaFolder,
  FaList,
  FaRegSquare,
  FaTh,
  FaUpload,
  FaArrowsAlt,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";
import UploadModal from "../components/UploadModal";
import CreateFolderModal from "../components/CreateFolderModal";
import { useUploadManager } from "../context/UploadManagerContext";
import { isExternalFileDrag, uploadDroppedEntries } from "../utils/dropUpload";
import { updateCopcSearchParams } from "../utils/copcSearchParams";
import { useSearchParams } from "react-router-dom";

const workflowStatusMeta = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return { label: "Approved", className: "bg-success" };
  if (key === "pending_program_chair") return { label: "Pending Dept Chair", className: "bg-warning text-dark" };
  if (key === "pending_qa") return { label: "Pending QA", className: "bg-primary" };
  if (key === "rejected_program_chair") return { label: "Needs Revision (Dept Chair)", className: "bg-danger" };
  if (key === "rejected_qa") return { label: "Needs Revision (QA)", className: "bg-danger" };
  return { label: "In Review", className: "bg-secondary" };
};

const reviewerStatusMeta = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return { label: "Approved", className: "text-success" };
  if (key === "rejected") return { label: "Rejected", className: "text-danger" };
  if (key === "pending") return { label: "Pending", className: "text-warning" };
  if (key === "not_required") return { label: "Not Required", className: "text-muted" };
  return { label: "N/A", className: "text-muted" };
};

const LEGACY_TASK_STATUS_MAP = {
  not_started: "pending",
  complete: "approved",
};

const normalizeTaskChecklistStatus = (status) => {
  const key = String(status || "").toLowerCase();
  return LEGACY_TASK_STATUS_MAP[key] || key || "pending";
};

const isChecklistTaskDone = (task) => {
  const status = normalizeTaskChecklistStatus(task?.status);
  return status === "approved" || Number(task?.percentage || 0) >= 100;
};

const isFullyApproved = (file) => {
  const workflow = file?.reviewWorkflow || {};
  return (
    String(workflow?.status || "") === "approved" &&
    String(workflow?.programChair?.status || "") === "approved" &&
    String(workflow?.qaOfficer?.status || "") === "approved"
  );
};

const formatFileSize = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (!value || Number.isNaN(value)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const rounded = size >= 10 ? size.toFixed(0) : size.toFixed(1);
  return `${rounded} ${units[index]}`;
};

export default function CopcUploadPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProgramId = String(searchParams.get("programId") || "");
  const requestedFolderId = String(searchParams.get("folderId") || "");
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";
  const normalizedRole = String(role || "").toLowerCase();
  const { startTrackedTask } = useUploadManager();

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programMeta, setProgramMeta] = useState(null);
  const [folders, setFolders] = useState([]);
  const [view, setView] = useState("grid");
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderQuery, setFolderQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [externalDropActive, setExternalDropActive] = useState(false);
  const [activeDropFolderId, setActiveDropFolderId] = useState("");
  const [uploadingDroppedItems, setUploadingDroppedItems] = useState(false);
  const [dropUploadMessage, setDropUploadMessage] = useState("");
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklistSections, setChecklistSections] = useState([]);
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(true);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [createTarget, setCreateTarget] = useState(null);
  const [loadingFolderFiles, setLoadingFolderFiles] = useState(false);
  const [approvedFilesInFolder, setApprovedFilesInFolder] = useState([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusSearch, setStatusSearch] = useState("");
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [uploadStatusCounts, setUploadStatusCounts] = useState({
    total: 0,
    approved: 0,
    pendingProgramChair: 0,
    pendingQa: 0,
    rejectedProgramChair: 0,
    rejectedQa: 0,
  });
  const CHECKLIST_PANEL_WIDTH = 420;
  const CHECKLIST_PANEL_TOP = 92;
  const CHECKLIST_PANEL_RIGHT = 18;
  const CHECKLIST_BOUNDARY_PADDING = 8;
  const deepLinkConsumedRef = useRef(false);
  const checklistCardRef = useRef(null);
  const checklistDragOffsetRef = useRef({ x: 0, y: 0 });
  const checklistDraggingRef = useRef(false);
  const checklistDragPointerIdRef = useRef(null);
  const checklistDragHandleRef = useRef(null);
  const checklistDragRafRef = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 0 : window.innerWidth
  );
  const [checklistPosition, setChecklistPosition] = useState({ x: null, y: null });
  const [isChecklistDragging, setIsChecklistDragging] = useState(false);

  const syncProgramQuery = (programId, extraUpdates = {}) =>
    updateCopcSearchParams(searchParams, setSearchParams, {
      programId,
      ...extraUpdates,
    });

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

  const endChecklistDrag = useCallback(() => {
    if (checklistDragRafRef.current) {
      window.cancelAnimationFrame(checklistDragRafRef.current);
      checklistDragRafRef.current = 0;
    }
    const handleEl = checklistDragHandleRef.current;
    const pointerId = checklistDragPointerIdRef.current;
    if (handleEl && pointerId !== null && typeof handleEl.releasePointerCapture === "function") {
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {}
    }
    checklistDragPointerIdRef.current = null;
    checklistDragHandleRef.current = null;
    if (!checklistDraggingRef.current) return;
    checklistDraggingRef.current = false;
    setIsChecklistDragging(false);
  }, []);

  const beginChecklistDrag = useCallback((event) => {
    if (typeof window === "undefined" || viewportWidth < 1200) return;
    if (typeof event.button === "number" && event.button !== 0) return;
    endChecklistDrag();
    const cardRect = checklistCardRef.current?.getBoundingClientRect();
    const fallback = getDefaultChecklistPosition();
    const originX = cardRect?.left ?? (Number.isFinite(checklistPosition.x) ? checklistPosition.x : fallback.x);
    const originY = cardRect?.top ?? (Number.isFinite(checklistPosition.y) ? checklistPosition.y : fallback.y);
    checklistDragOffsetRef.current = {
      x: event.clientX - originX,
      y: event.clientY - originY,
    };
    checklistDragPointerIdRef.current =
      typeof event.pointerId === "number" ? event.pointerId : null;
    checklistDragHandleRef.current = event.currentTarget || null;
    if (
      checklistDragHandleRef.current &&
      checklistDragPointerIdRef.current !== null &&
      typeof checklistDragHandleRef.current.setPointerCapture === "function"
    ) {
      try {
        checklistDragHandleRef.current.setPointerCapture(checklistDragPointerIdRef.current);
      } catch {}
    }
    checklistDraggingRef.current = true;
    setIsChecklistDragging(true);
    event.preventDefault();
    event.stopPropagation();
  }, [checklistPosition.x, checklistPosition.y, endChecklistDrag, getDefaultChecklistPosition, viewportWidth]);

  const buildFolderMap = (list = []) => {
    const map = new Map();
    (list || []).forEach((f) => map.set(String(f._id), f));
    return map;
  };

  const buildFolderPath = (folder, map, rootId) => {
    const parts = [];
    let cursor = folder;
    let guard = 0;
    while (cursor && guard < 100) {
      guard += 1;
      const id = String(cursor._id);
      if (id === String(rootId)) break;
      parts.unshift(cursor.name);
      const parentId = cursor.parentFolder ? String(cursor.parentFolder) : "";
      if (!parentId) break;
      cursor = map.get(parentId);
    }
    return parts.join(" / ");
  };

  const flattenTasks = (tasks = [], depth = 0, output = []) => {
    (tasks || []).forEach((task) => {
      output.push({
        _id: task?._id || `${task?.title || "task"}-${depth}`,
        title: task?.title || "Untitled Task",
        status: normalizeTaskChecklistStatus(task?.status),
        percentage: Number(task?.percentage || 0),
        depth,
      });
      flattenTasks(task?.children || [], depth + 1, output);
    });
    return output;
  };

  const markChecklistDoneFromApprovedUploads = (tasks = [], hasApprovedUpload = false) => {
    if (!hasApprovedUpload) return tasks;
    return (Array.isArray(tasks) ? tasks : []).map((task) => ({
      ...task,
      status: "approved",
      percentage: 100,
      autoCompletedByApproval: true,
    }));
  };

  const folderMap = useMemo(() => buildFolderMap(folders), [folders]);

  const currentFolder = useMemo(
    () => folders.find((f) => String(f._id) === String(currentFolderId)) || null,
    [folders, currentFolderId]
  );

  const breadcrumbs = useMemo(() => {
    if (!currentFolderId) return [];
    const trail = [];
    let cursor = folderMap.get(String(currentFolderId));
    let guard = 0;
    while (cursor && guard < 100) {
      guard += 1;
      trail.unshift(cursor);
      const parentId = cursor.parentFolder ? String(cursor.parentFolder) : "";
      if (!parentId || !folderMap.has(parentId)) break;
      cursor = folderMap.get(parentId);
    }
    return trail;
  }, [currentFolderId, folderMap]);

  const visibleFolders = useMemo(() => {
    const list = Array.isArray(folders) ? folders : [];
    const sorted = [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (!currentFolderId) {
      return sorted.filter((f) => {
        const parentId = f.parentFolder ? String(f.parentFolder) : "";
        return !parentId || !folderMap.has(parentId);
      });
    }
    return sorted.filter((f) => String(f.parentFolder || "") === String(currentFolderId));
  }, [folders, currentFolderId, folderMap]);

  const filteredFolders = useMemo(() => {
    const query = String(folderQuery || "").trim().toLowerCase();
    if (!query) return visibleFolders;
    return visibleFolders.filter((folder) => {
      const name = String(folder.name || "").toLowerCase();
      const path = String(folder.path || "").toLowerCase();
      return name.includes(query) || path.includes(query);
    });
  }, [visibleFolders, folderQuery]);

  const filteredApprovedFiles = useMemo(() => {
    if (!currentFolderId) return [];
    const list = Array.isArray(approvedFilesInFolder) ? approvedFilesInFolder : [];
    const query = String(folderQuery || "").trim().toLowerCase();
    if (!query) return list;
    return list.filter((file) => {
      const name = String(file.originalName || "").toLowerCase();
      return name.includes(query);
    });
  }, [approvedFilesInFolder, currentFolderId, folderQuery]);

  const hasExplorerItems = filteredFolders.length > 0 || filteredApprovedFiles.length > 0;

  const statusScopedFolderId = useMemo(() => {
    if (!currentFolderId) return "";
    const found = folders.some((folder) => String(folder._id) === String(currentFolderId));
    return found ? String(currentFolderId) : "";
  }, [currentFolderId, folders]);

  const filteredUploadStatuses = useMemo(() => {
    const q = String(statusSearch || "").trim().toLowerCase();
    if (!q) return uploadStatuses;
    return uploadStatuses.filter((item) => {
      const name = String(item.originalName || "").toLowerCase();
      const folderName = String(item.folderName || "").toLowerCase();
      const workflow = String(item.workflowStatus || "").toLowerCase();
      return name.includes(q) || folderName.includes(q) || workflow.includes(q);
    });
  }, [uploadStatuses, statusSearch]);

  const checklistStats = useMemo(() => {
    const tasks = checklistSections.flatMap((section) => section.tasks || []);
    const total = tasks.length;
    const completed = tasks.filter((task) => isChecklistTaskDone(task)).length;
    return { total, completed };
  }, [checklistSections]);

  const goUp = () => {
    if (!currentFolderId) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    setCurrentFolderId(parent ? parent._id : null);
  };

  const loadPrograms = async () => {
    const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, {
      params: { userId, role },
    });
    const list = Array.isArray(data) ? data : [];
    setPrograms(list);
    const requestedExists = requestedProgramId && list.some((item) => String(item._id) === requestedProgramId);
    const selectedExists = selectedProgramId && list.some((item) => String(item._id) === String(selectedProgramId));
    let nextProgramId = "";
    if (requestedExists) nextProgramId = requestedProgramId;
    else if (selectedExists) nextProgramId = String(selectedProgramId);
    else if (list.length > 0) nextProgramId = String(list[0]._id);

    setSelectedProgramId(nextProgramId);
    if (nextProgramId !== requestedProgramId || (!nextProgramId && requestedFolderId)) {
      syncProgramQuery(nextProgramId, { folderId: null });
    }
  };

  const loadApprovedFilesInFolder = async (folderId) => {
    if (!folderId) {
      setApprovedFilesInFolder([]);
      return;
    }
    setLoadingFolderFiles(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/files`, {
        params: {
          userId,
          role,
          parentFolder: folderId,
          sortBy: "date",
          sortOrder: "desc",
        },
      });
      const list = Array.isArray(data) ? data : [];
      setApprovedFilesInFolder(list.filter((file) => isFullyApproved(file)));
    } catch {
      setApprovedFilesInFolder([]);
    } finally {
      setLoadingFolderFiles(false);
    }
  };

  const loadUploadStatuses = async (programId, folderId = "", nextStatus = statusFilter) => {
    if (!programId || !userId) {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
      return;
    }
    setLoadingStatuses(true);
    try {
      const params = {
        userId,
        role,
        status: nextStatus || "all",
      };
      if (folderId) params.folderId = folderId;
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/my-upload-status`, {
        params,
      });
      setUploadStatuses(Array.isArray(data?.files) ? data.files : []);
      setUploadStatusCounts(
        data?.counts || {
          total: 0,
          approved: 0,
          pendingProgramChair: 0,
          pendingQa: 0,
          rejectedProgramChair: 0,
          rejectedQa: 0,
        }
      );
    } catch {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
    } finally {
      setLoadingStatuses(false);
    }
  };

  const loadProgramFolders = async (programId, preserveCurrentFolder = false) => {
    if (!programId) {
      setProgramMeta(null);
      setFolders([]);
      setChecklistSections([]);
      setCurrentFolderId(null);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/folders`, {
        params: { userId, role },
      });
      setProgramMeta(data?.program || null);

      const allFolders = Array.isArray(data?.folders) ? data.folders : [];
      const allMap = buildFolderMap(allFolders);
      const uploadable = allFolders
        .filter((f) => !!f.canUpload && !f.isProgramRoot)
        .map((f) => ({
          ...f,
          path: buildFolderPath(f, allMap, data?.program?._id || programId),
        }));

      const uploadableIds = new Set(uploadable.map((f) => String(f._id)));
      setFolders(uploadable);
      const shouldApplyDeepLink =
        !deepLinkConsumedRef.current &&
        !!requestedFolderId &&
        (!requestedProgramId || String(programId) === String(requestedProgramId));
      if (shouldApplyDeepLink) {
        deepLinkConsumedRef.current = true;
      }
      setCurrentFolderId((prev) => {
        if (shouldApplyDeepLink && uploadableIds.has(String(requestedFolderId))) {
          return String(requestedFolderId);
        }
        if (!preserveCurrentFolder || !prev) return null;
        return uploadableIds.has(String(prev)) ? prev : null;
      });

      setLoadingChecklist(true);
      try {
        const checklistRows = await Promise.all(
          uploadable.map(async (folder) => {
            if (!folder.taskCount) return { folder, tasks: [] };
            const taskRes = await axios.get(`${BACKEND_URL}/folders/${folder._id}/tasks`, {
              params: { userId, role },
            });
            const normalizedTasks = Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : [];
            const hasApprovedUpload =
              normalizedRole === "user"
                ? Number(folder?.approvedOwnFileCount || 0) > 0
                : Number(folder?.approvedFileCount || 0) > 0;
            return {
              folder,
              tasks: markChecklistDoneFromApprovedUploads(
                flattenTasks(normalizedTasks),
                hasApprovedUpload
              ),
            };
          })
        );
        setChecklistSections(checklistRows.filter((row) => row.tasks.length > 0));
      } catch {
        setChecklistSections([]);
      } finally {
        setLoadingChecklist(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const uploadFromDropDataTransfer = async (dataTransfer, destinationFolderId = currentFolderId || null) => {
    if (!selectedProgramId) {
      alert("Select a COPC program first.");
      return false;
    }
    if (!destinationFolderId) {
      alert("Open an assigned folder first, or drop directly on a folder card.");
      return false;
    }
    const inUploadableScope = folders.some((folder) => String(folder._id) === String(destinationFolderId));
    if (!inUploadableScope) {
      alert("You can only upload into assigned COPC folders.");
      return false;
    }

    setUploadingDroppedItems(true);
    setDropUploadMessage("Preparing dropped files...");
    try {
      startTrackedTask(
        {
          name: "COPC drag-and-drop upload",
          detail: "Uploading into the current COPC folder",
          statusText: "Preparing dropped files...",
          successText: "COPC upload complete",
          onSuccess: () => {
            loadProgramFolders(selectedProgramId, true).catch(() => {});
            loadUploadStatuses(selectedProgramId, statusScopedFolderId, statusFilter).catch(() => {});
            loadApprovedFilesInFolder(destinationFolderId).catch(() => {});
          },
        },
        async (task) => {
          const result = await uploadDroppedEntries({
            dataTransfer,
            destinationFolderId,
            userId,
            role,
            duplicateAction: "keep_both",
            signal: task.signal,
            onStatus: (message) => task.setStatusText(message),
            onProgress: ({ percent, statusText, detail }) => {
              task.setProgress(percent, { statusText, detail });
            },
          });
          return {
            result,
            statusText: `Uploaded ${result.uploadedCount} file${result.uploadedCount === 1 ? "" : "s"}`,
            detail: result.createdFolders > 0
              ? `${result.createdFolders} folders created`
              : "Files uploaded to the COPC workspace",
          };
        }
      );
      setDropUploadMessage("");
      return true;
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || "Drag-and-drop upload failed");
      setDropUploadMessage("");
      return false;
    } finally {
      setUploadingDroppedItems(false);
      setExternalDropActive(false);
      setActiveDropFolderId("");
    }
  };

  const handleFolderDragOver = (event, folderId) => {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setActiveDropFolderId(String(folderId));
  };

  const handleFolderDrop = async (event, folderId) => {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    await uploadFromDropDataTransfer(event.dataTransfer, folderId);
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
    loadPrograms().catch(() => setPrograms([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!requestedProgramId) return;
    const exists = programs.some((item) => String(item._id) === requestedProgramId);
    if (exists) setSelectedProgramId(requestedProgramId);
  }, [requestedProgramId, programs]);

  useEffect(() => {
    deepLinkConsumedRef.current = false;
  }, [requestedProgramId, requestedFolderId]);

  useEffect(() => {
    if (!selectedProgramId) return;
    setFolderQuery("");
    loadProgramFolders(selectedProgramId, false).catch(() => {
      setProgramMeta(null);
      setFolders([]);
      setChecklistSections([]);
      setCurrentFolderId(null);
    });
    loadUploadStatuses(selectedProgramId, "", statusFilter).catch(() => {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  useEffect(() => {
    if (!selectedProgramId) return;
    loadUploadStatuses(selectedProgramId, statusScopedFolderId, statusFilter).catch(() => {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, statusScopedFolderId, statusFilter]);

  useEffect(() => {
    loadApprovedFilesInFolder(currentFolderId).catch(() => setApprovedFilesInFolder([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, selectedProgramId]);

  useEffect(() => {
    if (!dropUploadMessage || uploadingDroppedItems) return;
    const timer = setTimeout(() => setDropUploadMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [dropUploadMessage, uploadingDroppedItems]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!checklistDraggingRef.current) return;
      if (
        checklistDragPointerIdRef.current !== null &&
        typeof event.pointerId === "number" &&
        event.pointerId !== checklistDragPointerIdRef.current
      ) {
        return;
      }
      if (checklistDragRafRef.current) return;
      const nextX = event.clientX - checklistDragOffsetRef.current.x;
      const nextY = event.clientY - checklistDragOffsetRef.current.y;
      checklistDragRafRef.current = window.requestAnimationFrame(() => {
        checklistDragRafRef.current = 0;
        setChecklistPosition(clampChecklistPosition(nextX, nextY));
      });
      event.preventDefault();
    };
    const stopChecklistDrag = (event) => {
      if (!checklistDraggingRef.current) return;
      if (
        checklistDragPointerIdRef.current !== null &&
        typeof event?.pointerId === "number" &&
        event.pointerId !== checklistDragPointerIdRef.current
      ) {
        return;
      }
      endChecklistDrag();
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopChecklistDrag);
    window.addEventListener("pointercancel", stopChecklistDrag);
    window.addEventListener("blur", endChecklistDrag);
    document.addEventListener("visibilitychange", endChecklistDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopChecklistDrag);
      window.removeEventListener("pointercancel", stopChecklistDrag);
      window.removeEventListener("blur", endChecklistDrag);
      document.removeEventListener("visibilitychange", endChecklistDrag);
      endChecklistDrag();
    };
  }, [clampChecklistPosition, endChecklistDrag]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      if (width < 1200) {
        endChecklistDrag();
        return;
      }
      setChecklistPosition((prev) => {
        const base =
          Number.isFinite(prev.x) && Number.isFinite(prev.y)
            ? prev
            : getDefaultChecklistPosition();
        return clampChecklistPosition(base.x, base.y);
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampChecklistPosition, endChecklistDrag, getDefaultChecklistPosition]);

  useEffect(() => {
    if (viewportWidth < 1200) return;
    setChecklistPosition((prev) => {
      if (Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
        return clampChecklistPosition(prev.x, prev.y);
      }
      const defaults = getDefaultChecklistPosition();
      return clampChecklistPosition(defaults.x, defaults.y);
    });
  }, [selectedProgramId, viewportWidth, clampChecklistPosition, getDefaultChecklistPosition]);

  useEffect(() => {
    if (!isChecklistDragging) return undefined;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isChecklistDragging]);

  const shouldFloatChecklist = viewportWidth >= 1600;
  const defaultChecklistPosition = shouldFloatChecklist ? getDefaultChecklistPosition() : { x: 0, y: 0 };
  const checklistLeft = Number.isFinite(checklistPosition.x) ? checklistPosition.x : defaultChecklistPosition.x;
  const checklistTop = Number.isFinite(checklistPosition.y) ? checklistPosition.y : defaultChecklistPosition.y;
  const showTaskChecklist = !loading && !!selectedProgramId;
  const shouldReserveChecklistSpace = showTaskChecklist && shouldFloatChecklist;

  return (
    <div
      className="container-fluid py-3 file-manager-container"
      style={shouldReserveChecklistSpace ? { paddingRight: "450px" } : undefined}
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
              ? "Drop files or folders to upload into this COPC workspace."
              : dropUploadMessage}
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {currentFolderId && (
            <button className="btn btn-outline-secondary" onClick={goUp}>
              <FaArrowLeft className="me-1" /> Back
            </button>
          )}
          <div className="d-flex align-items-center flex-wrap overflow-auto">
            <span className="fw-bold me-2 text-primary">COPC Upload Workspace</span>
            {breadcrumbs.map((b) => (
              <span key={b._id || "root"} className="d-flex align-items-center">
                <FaChevronRight className="mx-2 text-muted" size={12} />
                <button className="btn btn-link p-0 theme-text-strong text-decoration-none" onClick={() => setCurrentFolderId(b._id)}>
                  {b.name}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <select
            className="form-select"
            style={{ minWidth: "260px", width: "100%", maxWidth: "460px" }}
            value={selectedProgramId}
            onChange={(e) => {
              const nextProgramId = e.target.value;
              const programChanged = String(nextProgramId) !== String(selectedProgramId);
              setSelectedProgramId(nextProgramId);
              if (programChanged) setCurrentFolderId(null);
              syncProgramQuery(nextProgramId, programChanged ? { folderId: null } : {});
            }}
          >
            <option value="">Select Program</option>
            {programs.map((p) => (
              <option key={p._id} value={p._id}>
                {p.programCode || p.name} - {p.programName || p.name} ({p.year || "N/A"})
              </option>
            ))}
          </select>
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
            className="btn btn-primary"
            disabled={!currentFolder}
            title={currentFolder ? `Create folder in ${currentFolder.name}` : "Open a folder first"}
            onClick={() => currentFolder && setCreateTarget(currentFolder)}
          >
            <FaPlus className="me-1" /> New Folder
          </button>
          <button
            className="btn btn-success"
            disabled={!currentFolder}
            title={currentFolder ? `Upload to ${currentFolder.name}` : "Open a folder first"}
            onClick={() => currentFolder && setUploadTarget(currentFolder)}
          >
            <FaUpload className="me-1" /> Upload
          </button>
        </div>
      </div>

      {!selectedProgramId && <div className="alert alert-info">Select a COPC program to upload documents.</div>}

      {selectedProgramId && (
        <div className="alert alert-light border py-2 px-3 small mb-3">
          Step 1: select a program. Step 2: open a folder. Step 3: click upload.
        </div>
      )}

      {selectedProgramId && (
        <div className="alert alert-warning py-2 px-3 small mb-3">
          COPC file naming required inside COPC folders:{" "}
          <code>[College]_[Area#]_[DocName]_[Date].pdf</code>{" "}
          (Example: <code>COT_Area04_IT_Lab_Inventory_2026-03-19.pdf</code>)
        </div>
      )}

      {selectedProgramId && programMeta && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="fw-semibold">{programMeta.code} - {programMeta.name}</div>
            <div className="small text-muted">
              AY {programMeta.year || "N/A"} | {programMeta.isLocked ? "Locked after final approval" : "Open for upload based on assignment"}
            </div>
            <div className="small mt-1">
              <span className="badge text-bg-light border me-2">Folders: {folders.length}</span>
              <span className="badge text-bg-light border">Current: {currentFolder?.name || "Root"}</span>
            </div>
          </div>
        </div>
      )}

      {selectedProgramId && currentFolder && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="fw-semibold small">Approved Files in Folder: {currentFolder.name}</div>
            <span className="badge text-bg-light border">Approved: {approvedFilesInFolder.length}</span>
          </div>
          <div className="card-body py-2">
            {loadingFolderFiles && <div className="small text-muted">Loading approved files...</div>}
            {!loadingFolderFiles && approvedFilesInFolder.length === 0 && (
              <div className="small text-muted">
                No fully approved files in this folder yet. Files appear here after Dept Chair and QA approval.
              </div>
            )}
            {!loadingFolderFiles && approvedFilesInFolder.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>File</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedFilesInFolder.map((file) => (
                      <tr key={`approved-folder-file-${file._id}`}>
                        <td className="small fw-semibold">{file.originalName}</td>
                        <td className="small">{formatFileSize(file.size)}</td>
                        <td className="small">{file.uploadDate ? new Date(file.uploadDate).toLocaleString() : "N/A"}</td>
                        <td className="text-center">
                          <div className="d-flex gap-1 justify-content-center">
                            <a
                              className="btn btn-sm btn-outline-primary"
                              href={`${BACKEND_URL}/preview/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Preview"
                            >
                              <FaEye />
                            </a>
                            <a
                              className="btn btn-sm btn-outline-success"
                              href={`${BACKEND_URL}/download/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                              title="Download"
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
          </div>
        </div>
      )}

      {selectedProgramId && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="fw-semibold small">
              My Uploaded Files Status {currentFolder ? `- ${currentFolder.name}` : "(Program Scope)"}
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <span className="badge text-bg-light border">Total: {uploadStatusCounts.total}</span>
              <span className="badge text-bg-light border">Approved: {uploadStatusCounts.approved}</span>
              <span className="badge text-bg-light border">Pending Dept Chair: {uploadStatusCounts.pendingProgramChair}</span>
              <span className="badge text-bg-light border">Pending QA: {uploadStatusCounts.pendingQa}</span>
              <span className="badge text-bg-light border text-danger">Revisions: {uploadStatusCounts.rejectedProgramChair + uploadStatusCounts.rejectedQa}</span>
            </div>
          </div>
          <div className="card-body py-2">
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: "240px" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending_program_chair">Pending Dept Chair</option>
                <option value="pending_qa">Pending QA</option>
                <option value="approved">Approved</option>
                <option value="rejected_program_chair">Needs Revision (Dept Chair)</option>
                <option value="rejected_qa">Needs Revision (QA)</option>
              </select>
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: "360px" }}
                placeholder="Search uploaded file"
                value={statusSearch}
                onChange={(e) => setStatusSearch(e.target.value)}
              />
            </div>
            {loadingStatuses && <div className="small text-muted">Loading upload status...</div>}
            {!loadingStatuses && filteredUploadStatuses.length === 0 && (
              <div className="small text-muted">
                No uploaded files found in this scope yet.
              </div>
            )}
            {!loadingStatuses && filteredUploadStatuses.length > 0 && (
              <div className="table-responsive workspace-status-table-wrap">
                <table className="table table-sm align-middle mb-0 workspace-status-table">
                  <thead className="table-light">
                    <tr>
                      <th>File</th>
                      <th>Folder</th>
                      <th>Uploaded</th>
                      <th>Status</th>
                      <th>Dept Chair</th>
                      <th>QA</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUploadStatuses.slice(0, 25).map((item) => {
                      const workflow = workflowStatusMeta(item.workflowStatus);
                      const chair = reviewerStatusMeta(item.programChairStatus);
                      const qa = reviewerStatusMeta(item.qaStatus);
                      const revisionNote = String(item.programChairNotes || item.qaNotes || "").trim();
                      return (
                        <tr key={`upload-status-${item._id}`}>
                          <td>
                            <div className="fw-semibold text-truncate" style={{ maxWidth: "260px" }} title={item.originalName}>
                              {item.originalName}
                            </div>
                            <div className="small text-muted">{formatFileSize(item.size)}</div>
                            {revisionNote && (
                              <div className="small text-danger text-truncate" style={{ maxWidth: "260px" }} title={revisionNote}>
                                Note: {revisionNote}
                              </div>
                            )}
                          </td>
                          <td className="small">{item.folderName}</td>
                          <td className="small">
                            {item.uploadDate ? new Date(item.uploadDate).toLocaleString() : "N/A"}
                          </td>
                          <td>
                            <span className={`badge ${workflow.className}`}>{workflow.label}</span>
                          </td>
                          <td className={`small fw-semibold ${chair.className}`}>{chair.label}</td>
                          <td className={`small fw-semibold ${qa.className}`}>{qa.label}</td>
                          <td className="text-center">
                            <a
                              className="btn btn-sm btn-outline-primary"
                              href={`${BACKEND_URL}/preview/${item.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Preview file"
                            >
                              <FaEye />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loadingStatuses && filteredUploadStatuses.length > 25 && (
              <div className="small text-muted mt-2">
                Showing first 25 results. Use search/filter to narrow down.
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <div className="small text-muted mb-3">Loading COPC folders...</div>}

      {!loading && selectedProgramId && (
        <div
          ref={checklistCardRef}
          className="card shadow-sm mb-3"
          style={shouldFloatChecklist
              ? {
                  position: "fixed",
                  left: checklistLeft,
                  top: checklistTop,
                  width: "420px",
                maxHeight: "82vh",
                  overflowY: "auto",
                  zIndex: 9,
                }
              : { width: "min(460px, 100%)", marginLeft: "auto" }}
        >
          <div className="card-header bg-light py-2">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                {shouldFloatChecklist && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-0 px-2"
                    onPointerDown={beginChecklistDrag}
                    title="Drag checklist"
                    aria-label="Drag checklist"
                    style={{
                      cursor: isChecklistDragging ? "grabbing" : "grab",
                      touchAction: "none",
                      userSelect: "none",
                    }}
                  >
                    <FaArrowsAlt />
                  </button>
                )}
                <div className="fw-semibold small">Task Checklist</div>
              </div>
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
          </div>
          {!isChecklistCollapsed && (
            <div className="card-body py-2" style={{ maxHeight: "240px", overflowY: "auto" }}>
              {loadingChecklist && <div className="small text-muted">Loading checklist...</div>}
              {!loadingChecklist && checklistSections.length === 0 && (
                <div className="small text-muted">No checklist tasks found for your assigned upload folders.</div>
              )}
              {!loadingChecklist && checklistSections.length > 0 && (
                <div className="d-flex flex-column gap-2">
                  {checklistSections.map((section) => (
                    <div key={`chk-${section.folder._id}`}>
                      <div className="small fw-semibold mb-1">{section.folder.name}</div>
                      <div className="d-flex flex-column gap-1">
                        {section.tasks.map((task) => (
                          <div key={`tsk-${section.folder._id}-${task._id}-${task.depth}`} className="d-flex align-items-center gap-2 small">
                            <span style={{ width: `${task.depth * 12}px` }} />
                            {isChecklistTaskDone(task) ? (
                              <FaCheckSquare className="text-success" />
                            ) : (
                              <FaRegSquare className="text-muted" />
                            )}
                            <span className={isChecklistTaskDone(task) ? "text-success" : ""}>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && selectedProgramId && (
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <input
            className="form-control"
            style={{ maxWidth: "380px" }}
            placeholder="Search folder name/path"
            value={folderQuery}
            onChange={(e) => setFolderQuery(e.target.value)}
          />
          {currentFolderId && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setCurrentFolderId(null)}>
              Go to Root
            </button>
          )}
        </div>
      )}

      {!loading && selectedProgramId && !hasExplorerItems && (
        <div className="text-center py-5">
          <FaFolder className="text-muted mb-3" size={48} />
          <h5 className="text-muted">
            {folderQuery ? "No folders/files match your search" : "No folders or approved files in this scope"}
          </h5>
        </div>
      )}

      {!loading && hasExplorerItems && view === "grid" && (
        <div className="workspace-explorer-grid">
          {filteredFolders.map((folder) => (
            <div key={folder._id} className="workspace-explorer-grid__item">
              <div
                className="card folder-card workspace-explorer-card h-100 text-center p-3 position-relative"
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
                <h6 className="card-title text-truncate" title={folder.path || folder.name}>{folder.name}</h6>
                <p className="text-muted small text-truncate" title={folder.path || folder.name}>{folder.path || folder.name}</p>
                <div className="workspace-explorer-actions mt-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => setCurrentFolderId(folder._id)} title="Open folder">
                    <FaEye className="me-1" /> Open
                  </button>
                  <button className="btn btn-sm btn-outline-success" onClick={() => setUploadTarget(folder)} title="Upload here">
                    <FaUpload className="me-1" /> Upload
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredApprovedFiles.map((file) => (
            <div key={`approved-grid-${file._id}`} className="workspace-explorer-grid__item">
              <div className="card workspace-explorer-card h-100 text-center p-3 position-relative border-success">
                <FaFileAlt size={42} className="text-primary mb-3" />
                <h6 className="card-title text-truncate" title={file.originalName}>{file.originalName}</h6>
                <p className="text-muted small mb-1">{formatFileSize(file.size)}</p>
                <p className="text-muted small text-truncate mb-2" title={file.uploadDate ? new Date(file.uploadDate).toLocaleString() : "N/A"}>
                  {file.uploadDate ? new Date(file.uploadDate).toLocaleString() : "N/A"}
                </p>
                <span className="badge bg-success mb-2">Approved</span>
                <div className="workspace-explorer-actions mt-1">
                  <a
                    className="btn btn-sm btn-outline-primary"
                    href={`${BACKEND_URL}/preview/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Preview"
                  >
                    <FaEye />
                  </a>
                  <a
                    className="btn btn-sm btn-outline-success"
                    href={`${BACKEND_URL}/download/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                    title="Download"
                  >
                    <FaCloudDownloadAlt />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasExplorerItems && view === "list" && (
        <div className="d-flex flex-column gap-3">
          {filteredFolders.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Path</th>
                    <th>Tasks</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFolders.map((folder) => (
                    <tr
                      key={folder._id}
                      onDragOver={(e) => handleFolderDragOver(e, folder._id)}
                      onDrop={(e) => handleFolderDrop(e, folder._id)}
                      onDragLeave={() => {
                        if (activeDropFolderId === String(folder._id)) setActiveDropFolderId("");
                      }}
                      style={activeDropFolderId === String(folder._id)
                        ? { outline: "2px dashed #0d6efd", outlineOffset: "-2px" }
                        : undefined}
                    >
                      <td className="d-flex align-items-center">
                        <FaFolder className="text-warning me-2" />
                        {folder.name}
                      </td>
                      <td className="small text-muted">{folder.path || folder.name}</td>
                      <td>{folder.taskCount || 0}</td>
                      <td className="text-center">
                        <div className="btn-group">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => setCurrentFolderId(folder._id)}>
                            <FaEye className="me-1" /> Open
                          </button>
                          <button className="btn btn-sm btn-outline-success" onClick={() => setUploadTarget(folder)}>
                            <FaUpload className="me-1" /> Upload
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredApprovedFiles.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Approved File</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovedFiles.map((file) => (
                    <tr key={`approved-list-${file._id}`}>
                      <td className="d-flex align-items-center">
                        <FaFileAlt className="text-primary me-2" />
                        {file.originalName}
                      </td>
                      <td className="small">{formatFileSize(file.size)}</td>
                      <td className="small">{file.uploadDate ? new Date(file.uploadDate).toLocaleString() : "N/A"}</td>
                      <td className="text-center">
                        <div className="btn-group">
                          <a
                            className="btn btn-sm btn-outline-primary"
                            href={`${BACKEND_URL}/preview/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Preview"
                          >
                            <FaEye />
                          </a>
                          <a
                            className="btn btn-sm btn-outline-success"
                            href={`${BACKEND_URL}/download/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                            title="Download"
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
        </div>
      )}

      {uploadTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <UploadModal
            onClose={() => setUploadTarget(null)}
            onUploaded={() => {
              loadProgramFolders(selectedProgramId, true).catch(() => {});
              loadUploadStatuses(selectedProgramId, statusScopedFolderId, statusFilter).catch(() => {});
              loadApprovedFilesInFolder(statusScopedFolderId || currentFolderId).catch(() => {});
            }}
            parentFolder={uploadTarget._id}
            hideDestinationFolder
          />
        </>
      )}

      {createTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <CreateFolderModal
            onClose={() => setCreateTarget(null)}
            onCreated={() => {
              loadProgramFolders(selectedProgramId, true).catch(() => {});
            }}
            parentFolder={createTarget._id}
          />
        </>
      )}
    </div>
  );
}
