import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaFolder, FaListUl, FaPlus, FaSearch, FaTrashAlt } from "react-icons/fa";
import { BACKEND_URL } from "../config";
import "./task-management.css";

const TASK_TEMPLATE_SETS = {
  copc_bsit: [
    { title: "Program Profile Review", scope: "01 Program Profile" },
    { title: "Curriculum Standards Compliance", scope: "02 Curriculum" },
    { title: "Faculty Qualification Compliance", scope: "03 Faculty" },
    { title: "Facilities Standards Check", scope: "04 Facilities" },
    { title: "Library Resources Compliance", scope: "05 Library" },
    { title: "Administration Policy Compliance", scope: "06 Administration" },
    { title: "Supporting Documents Validation", scope: "07 Supporting Documents" },
  ],
};

const normalizeTaskStatus = (status) => String(status || "").toLowerCase();

const filterTaskTree = (tasks = [], query = "") => {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return tasks;

  return tasks
    .map((task) => {
      const title = String(task?.title || "").toLowerCase();
      const scope = String(task?.scope || "").toLowerCase();
      const description = String(task?.description || "").toLowerCase();
      const status = normalizeTaskStatus(task?.status);
      const children = filterTaskTree(task?.children || [], normalizedQuery);
      const matched =
        title.includes(normalizedQuery) ||
        scope.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        status.includes(normalizedQuery);

      if (matched || children.length) {
        return { ...task, children };
      }

      return null;
    })
    .filter(Boolean);
};

const summarizeTasks = (tasks = [], summary = { total: 0, completed: 0, inProgress: 0, notStarted: 0 }) => {
  tasks.forEach((task) => {
    summary.total += 1;
    const status = normalizeTaskStatus(task?.status);
    if (status === "complete") {
      summary.completed += 1;
    } else if (status === "in_progress") {
      summary.inProgress += 1;
    } else {
      summary.notStarted += 1;
    }
    summarizeTasks(task?.children || [], summary);
  });
  return summary;
};

const BOARD_COLUMNS = [
  { key: "not_started", title: "To Do" },
  { key: "in_progress", title: "In Progress" },
  { key: "complete", title: "Done" },
];

const normalizeBoardStatus = (status) => {
  const key = normalizeTaskStatus(status);
  if (["not_started", "in_progress", "complete"].includes(key)) return key;
  if (key === "approved") return "complete";
  if (key === "pending") return "not_started";
  return "not_started";
};

const flattenTaskTree = (tasks = [], depth = 0, output = []) => {
  (tasks || []).forEach((task) => {
    output.push({
      ...task,
      depth,
    });
    flattenTaskTree(task?.children || [], depth + 1, output);
  });
  return output;
};

const normalizeRole = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw === "admin") return "superadmin";
  if (raw === "user") return "faculty";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  if (raw === "reviewer") return "evaluator";
  return raw;
};

const toObjectIdString = (value) => String(value?._id || value || "").trim();

const getTaskUploaderId = (task) => {
  const directUploaders = Array.isArray(task?.assignedUploaders)
    ? task.assignedUploaders.map((entry) => toObjectIdString(entry)).filter(Boolean)
    : [];
  if (directUploaders.length > 0) return directUploaders[0];

  const assignedRole = normalizeRole(task?.assignedRole || "");
  if (assignedRole === "faculty" && task?.assignedTo) {
    return toObjectIdString(task.assignedTo);
  }
  return "";
};

const formatUploaderLabel = (uploader) => {
  const name = String(uploader?.name || "").trim();
  const email = String(uploader?.email || "").trim();
  if (name && email) return `${name} (${email})`;
  return name || email || "Uploader";
};

export default function AdminTasksPage() {
  const role = localStorage.getItem("role") || "superadmin";
  const userId = localStorage.getItem("userId");
  const normalizedRole = normalizeRole(role);
  const canAssignTaskUploaders = ["superadmin", "dept_chair"].includes(normalizedRole);
  const canEditTaskContent = ["superadmin", "dept_chair"].includes(normalizedRole);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProgramId = searchParams.get("programId") || "";
  const initialFolderId = searchParams.get("folderId") || "";

  const [folders, setFolders] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(initialProgramId);
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [folderTasks, setFolderTasks] = useState([]);
  const [taskProgress, setTaskProgress] = useState(0);
  const [templateKey, setTemplateKey] = useState("copc_bsit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [uploaderPool, setUploaderPool] = useState([]);
  const [assigningTaskId, setAssigningTaskId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [taskEditDraft, setTaskEditDraft] = useState({ title: "", description: "" });
  const [savingTaskId, setSavingTaskId] = useState("");
  const [showCreateCard, setShowCreateCard] = useState(true);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    scope: "",
    comments: "",
  });

  const updateTaskSearchParams = useCallback(
    (programId, folderId) => {
      const next = new URLSearchParams(searchParams);
      if (programId) {
        next.set("programId", String(programId));
      } else {
        next.delete("programId");
      }
      if (folderId) {
        next.set("folderId", String(folderId));
      } else {
        next.delete("folderId");
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const loadFolders = useCallback(async () => {
    const { data } = await axios.get(`${BACKEND_URL}/folders/all`, { params: { userId, role } });
    const allFolders = Array.isArray(data) ? data : [];
    const folderById = new Map(allFolders.map((folder) => [String(folder._id), folder]));
    const isCopcScoped = (folder) => {
      const ownProfile = String(folder?.complianceProfileKey || "").toUpperCase();
      if (ownProfile.startsWith("COPC_") || !!folder?.copc?.isProgramRoot) return true;

      let cursor = folder;
      let guard = 0;
      while (cursor?.parentFolder && guard < 200) {
        guard += 1;
        const parent = folderById.get(String(cursor.parentFolder));
        if (!parent) break;
        const parentProfile = String(parent?.complianceProfileKey || "").toUpperCase();
        if (parentProfile.startsWith("COPC_") || !!parent?.copc?.isProgramRoot) return true;
        cursor = parent;
      }
      return false;
    };

    const copcFolders = allFolders.filter(isCopcScoped);
    setFolders(copcFolders);
  }, [role, userId]);

  const loadTasks = useCallback(
    async (folderId) => {
      if (!folderId) {
        setFolderTasks([]);
        setTaskProgress(0);
        setUploaderPool([]);
        return;
      }
      const { data } = await axios.get(`${BACKEND_URL}/folders/${folderId}/tasks`, {
        params: { userId, role },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
      setUploaderPool(Array.isArray(data?.assignmentPool?.uploaders) ? data.assignmentPool.uploaders : []);
    },
    [role, userId]
  );

  useEffect(() => {
    loadFolders().catch(() => setFolders([]));
  }, [loadFolders]);

  useEffect(() => {
    loadTasks(currentFolderId).catch(() => {
      setFolderTasks([]);
      setTaskProgress(0);
      setUploaderPool([]);
    });
  }, [currentFolderId, loadTasks]);

  const currentFolder = useMemo(
    () => folders.find((f) => String(f._id) === String(currentFolderId)),
    [folders, currentFolderId]
  );

  const foldersById = useMemo(() => {
    const map = new Map();
    folders.forEach((folder) => map.set(String(folder._id), folder));
    return map;
  }, [folders]);

  const programRoots = useMemo(
    () =>
      folders
        .filter((folder) => !!folder?.copc?.isProgramRoot)
        .sort((a, b) =>
          String(a?.copc?.programCode || a?.name || "").localeCompare(
            String(b?.copc?.programCode || b?.name || "")
          )
        ),
    [folders]
  );

  const folderProgramById = useMemo(() => {
    const map = new Map();
    const resolveProgramId = (folderId) => {
      let cursor = foldersById.get(String(folderId));
      let guard = 0;
      while (cursor && guard < 200) {
        guard += 1;
        if (cursor?.copc?.isProgramRoot) return String(cursor._id);
        if (!cursor.parentFolder) return "";
        cursor = foldersById.get(String(cursor.parentFolder));
      }
      return "";
    };

    folders.forEach((folder) => {
      map.set(String(folder._id), resolveProgramId(folder._id));
    });
    return map;
  }, [folders, foldersById]);

  const foldersForSelectedProgram = useMemo(() => {
    if (!selectedProgramId) return [];
    return folders
      .filter((folder) => folderProgramById.get(String(folder._id)) === String(selectedProgramId))
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [folders, folderProgramById, selectedProgramId]);

  const folderOptionLabelById = useMemo(() => {
    const map = new Map();
    foldersForSelectedProgram.forEach((folder) => {
      const parts = [];
      let cursor = folder;
      let guard = 0;
      while (cursor && guard < 200) {
        guard += 1;
        parts.unshift(String(cursor?.name || "Untitled"));
        if (String(cursor._id) === String(selectedProgramId) || !cursor.parentFolder) break;
        cursor = foldersById.get(String(cursor.parentFolder));
      }
      map.set(String(folder._id), parts.join(" / "));
    });
    return map;
  }, [foldersForSelectedProgram, foldersById, selectedProgramId]);

  const currentProgram = useMemo(
    () => programRoots.find((program) => String(program._id) === String(selectedProgramId)) || null,
    [programRoots, selectedProgramId]
  );

  const programLabel = (program) => {
    const code = String(program?.copc?.programCode || "").trim();
    const name = String(program?.copc?.programName || program?.name || "").trim();
    const year = program?.copc?.year ? ` (${program.copc.year})` : "";
    if (code && name && code !== name) return `${code} - ${name}${year}`;
    return `${name || code || "Program"}${year}`;
  };

  useEffect(() => {
    if (!currentFolderId) return;

    const inferredProgramId = folderProgramById.get(String(currentFolderId)) || "";
    if (!selectedProgramId && inferredProgramId) {
      setSelectedProgramId(inferredProgramId);
      return;
    }

    const existsInScope = selectedProgramId
      ? foldersForSelectedProgram.some((folder) => String(folder._id) === String(currentFolderId))
      : folders.some((folder) => String(folder._id) === String(currentFolderId));

    if (!existsInScope) {
      setCurrentFolderId("");
      updateTaskSearchParams(selectedProgramId, "");
    }
  }, [
    currentFolderId,
    selectedProgramId,
    folders,
    foldersForSelectedProgram,
    folderProgramById,
    updateTaskSearchParams,
  ]);

  useEffect(() => {
    if (!selectedProgramId) return;
    const exists = programRoots.some((program) => String(program._id) === String(selectedProgramId));
    if (!exists) {
      setSelectedProgramId("");
      setCurrentFolderId("");
      updateTaskSearchParams("", "");
    }
  }, [selectedProgramId, programRoots, updateTaskSearchParams]);

  const setTaskStatus = async (taskId, status) => {
    if (!currentFolderId || !taskId) return;
    const { data } = await axios.patch(`${BACKEND_URL}/folders/${currentFolderId}/tasks/${taskId}/check`, {
      userId,
      role,
      status,
      percentage: status === "complete" ? 100 : status === "in_progress" ? 50 : 0,
    });
    setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    setTaskProgress(Number(data?.progress || 0));
  };

  const assignTaskUploader = async (taskId, uploaderId) => {
    if (!canAssignTaskUploaders || !currentFolderId || !taskId) return;
    setAssigningTaskId(String(taskId));
    try {
      const { data } = await axios.patch(`${BACKEND_URL}/folders/${currentFolderId}/tasks/${taskId}`, {
        userId,
        role,
        updates: {
          assignedUploaders: uploaderId ? [uploaderId] : [],
        },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to assign uploader");
    } finally {
      setAssigningTaskId("");
    }
  };

  const removeTask = async (taskId) => {
    if (!currentFolderId || !taskId) return;
    if (!window.confirm("Remove this task from the folder?")) return;
    try {
      const { data } = await axios.delete(`${BACKEND_URL}/folders/${currentFolderId}/tasks/${taskId}`, {
        data: { userId, role },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to remove task");
    }
  };

  const submitTask = async () => {
    if (!currentFolderId || !taskDraft.title.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        title: taskDraft.title.trim(),
        scope: taskDraft.scope || currentFolder?.name || "General",
        description: taskDraft.comments || "",
        status: "not_started",
        percentage: 0,
      };
      const { data } = await axios.post(`${BACKEND_URL}/folders/${currentFolderId}/tasks`, {
        userId,
        role,
        task: payload,
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
      setTaskDraft({
        title: "",
        scope: taskDraft.scope || "",
        comments: "",
      });
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to add task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSuggestedTasks = async () => {
    if (!currentFolderId) return;
    try {
      const templates = TASK_TEMPLATE_SETS[templateKey] || [];
      await Promise.all(
        templates.map((task) =>
          axios.post(`${BACKEND_URL}/folders/${currentFolderId}/tasks`, {
            userId,
            role,
            task: { ...task, status: "not_started", percentage: 0 },
          })
        )
      );
      await loadTasks(currentFolderId);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to add suggested tasks");
    }
  };

  const startEditTask = (task) => {
    const taskId = toObjectIdString(task?._id);
    if (!taskId) return;
    setEditingTaskId(taskId);
    setTaskEditDraft({
      title: String(task?.title || ""),
      description: String(task?.description || ""),
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId("");
    setTaskEditDraft({ title: "", description: "" });
  };

  const saveTaskContent = async (taskId) => {
    if (!canEditTaskContent || !currentFolderId || !taskId) return;
    const title = String(taskEditDraft.title || "").trim();
    if (!title) {
      alert("Task title is required");
      return;
    }

    setSavingTaskId(String(taskId));
    try {
      const { data } = await axios.patch(`${BACKEND_URL}/folders/${currentFolderId}/tasks/${taskId}`, {
        userId,
        role,
        updates: {
          title,
          description: String(taskEditDraft.description || ""),
        },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
      cancelEditTask();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update task");
    } finally {
      setSavingTaskId("");
    }
  };

  const availableUploaders = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(uploaderPool) ? uploaderPool : [])
      .map((entry) => ({
        _id: toObjectIdString(entry?._id || entry),
        name: String(entry?.name || "").trim(),
        email: String(entry?.email || "").trim(),
      }))
      .filter((entry) => {
        if (!entry._id || seen.has(entry._id)) return false;
        seen.add(entry._id);
        return true;
      })
      .sort((a, b) => formatUploaderLabel(a).localeCompare(formatUploaderLabel(b)));
  }, [uploaderPool]);

  const uploaderNameById = useMemo(
    () =>
      new Map(
        availableUploaders.map((entry) => [
          String(entry._id),
          String(entry.name || entry.email || "Unassigned uploader"),
        ])
      ),
    [availableUploaders]
  );

  const taskSummary = useMemo(() => summarizeTasks(folderTasks), [folderTasks]);
  const filteredTasks = useMemo(() => filterTaskTree(folderTasks, taskQuery), [folderTasks, taskQuery]);
  const filteredTaskSummary = useMemo(() => summarizeTasks(filteredTasks), [filteredTasks]);
  const flatFilteredTasks = useMemo(() => flattenTaskTree(filteredTasks), [filteredTasks]);

  const taskColumns = useMemo(() => {
    const grouped = {
      not_started: [],
      in_progress: [],
      complete: [],
    };

    flatFilteredTasks.forEach((task) => {
      const status = normalizeBoardStatus(task?.status);
      grouped[status].push(task);
    });

    return grouped;
  }, [flatFilteredTasks]);

  const renderTaskCard = (task) => {
    const status = normalizeBoardStatus(task?.status);
    const toneClass =
      status === "complete"
        ? "task-status-complete"
        : status === "in_progress"
          ? "task-status-progress"
          : "task-status-pending";
    const progressValue = Number(
      task?.percentage || (status === "complete" ? 100 : status === "in_progress" ? 50 : 0)
    );
    const taskId = toObjectIdString(task?._id);
    const assignedUploaderId = getTaskUploaderId(task);
    const assignedUploaderName = assignedUploaderId
      ? (uploaderNameById.get(assignedUploaderId) || "Assigned uploader")
      : "Unassigned";
    const assignmentIsPending = !!taskId && assigningTaskId === taskId;
    const isEditing = !!taskId && editingTaskId === taskId;
    const editIsSaving = !!taskId && savingTaskId === taskId;

    return (
      <article className={`task-board-card status-${status}`}>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span className="task-card-scope">{task?.scope || "General"}</span>
          <span className={`badge ${toneClass}`}>{status.replace("_", " ")}</span>
        </div>
        {isEditing ? (
          <>
            <input
              className="form-control form-control-sm task-card-inline-input"
              value={taskEditDraft.title}
              onChange={(e) => setTaskEditDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Task title"
            />
            <textarea
              className="form-control form-control-sm mt-2 task-card-inline-textarea"
              rows={3}
              value={taskEditDraft.description}
              onChange={(e) => setTaskEditDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Task description"
            />
          </>
        ) : (
          <>
            <div className="task-card-title">{task?.title || "Untitled Task"}</div>
            {task?.description ? (
              <div className="task-card-description" title={task.description}>
                {task.description}
              </div>
            ) : (
              <div className="task-card-description text-muted">No description provided.</div>
            )}
          </>
        )}
        <div className="task-card-meta small text-muted mt-2">
          Progress: {Math.round(progressValue)}% {task?.depth ? `| Subtask level ${task.depth}` : ""}
          <br />
          Uploader: {assignedUploaderName}
        </div>
        <div className="task-card-footer mt-2">
          <select
            className="form-select form-select-sm"
            value={status}
            onChange={(e) => setTaskStatus(task?._id, e.target.value)}
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="complete">Complete</option>
          </select>
          {canAssignTaskUploaders && (
            <select
              className="form-select form-select-sm task-card-assignee-select"
              value={assignedUploaderId}
              onChange={(e) => assignTaskUploader(task?._id, e.target.value)}
              disabled={assignmentIsPending || availableUploaders.length < 1}
              title="Assign task to a COPC workflow uploader"
            >
              {availableUploaders.length < 1 ? (
                <option value="">No COPC uploaders in workflow</option>
              ) : (
                <>
                  <option value="">Unassigned</option>
                  {availableUploaders.map((uploader) => (
                    <option key={uploader._id} value={uploader._id}>
                      {formatUploaderLabel(uploader)}
                    </option>
                  ))}
                </>
              )}
            </select>
          )}
          {canEditTaskContent && !isEditing && (
            <button
              className="btn btn-sm btn-outline-primary"
              type="button"
              onClick={() => startEditTask(task)}
              title="Edit task title and description"
            >
              Edit
            </button>
          )}
          {canEditTaskContent && isEditing && (
            <>
              <button
                className="btn btn-sm btn-primary"
                type="button"
                onClick={() => saveTaskContent(taskId)}
                disabled={editIsSaving}
              >
                {editIsSaving ? "Saving..." : "Save"}
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                onClick={cancelEditTask}
                disabled={editIsSaving}
              >
                Cancel
              </button>
            </>
          )}
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={() => removeTask(task?._id)}
            title="Remove task"
            type="button"
          >
            <FaTrashAlt />
          </button>
        </div>
      </article>
    );
  };

  const hasSelectedFolder = !!currentFolderId;

  return (
    <div className="container-fluid py-3 task-management-page">
      <div className="task-hub-shell">
        <header className="task-hub-topbar">
          <div className="task-hub-brand">
            <FaListUl className="me-2" />
            Workflow Hub
          </div>
          <div className="task-hub-nav">
            <button type="button" className="task-hub-nav-item">Dashboard</button>
            <button type="button" className="task-hub-nav-item">My Tasks</button>
            <button type="button" className="task-hub-nav-item is-active">Projects</button>
            <button type="button" className="task-hub-nav-item">Calendar</button>
          </div>
          <div className="task-hub-meta">
            <span className="badge text-bg-light border">{taskSummary.total} tasks</span>
            <span className="badge text-bg-light border">{Math.round(taskProgress)}% complete</span>
          </div>
        </header>

        <div className="task-hub-body">
          <aside className="task-hub-sidebar">
            <div className="task-side-card">
              <label className="form-label small fw-semibold">Program</label>
              <select
                className="form-select mb-2"
                value={selectedProgramId}
                onChange={(e) => {
                  const nextProgramId = e.target.value;
                  setSelectedProgramId(nextProgramId);
                  setTaskDraft((prev) => ({ ...prev, scope: "" }));

                  const folderStillValid =
                    currentFolderId &&
                    folderProgramById.get(String(currentFolderId)) === String(nextProgramId);
                  const nextFolderId = folderStillValid ? currentFolderId : "";
                  setCurrentFolderId(nextFolderId);
                  updateTaskSearchParams(nextProgramId, nextFolderId);
                }}
              >
                <option value="">Select program</option>
                {programRoots.map((program) => (
                  <option key={program._id} value={program._id}>
                    {programLabel(program)}
                  </option>
                ))}
              </select>

              <label className="form-label small fw-semibold"><FaFolder className="me-1" />Folder</label>
              <select
                className="form-select"
                disabled={!selectedProgramId}
                value={currentFolderId}
                onChange={(e) => {
                  const next = e.target.value;
                  setCurrentFolderId(next);
                  setTaskDraft((prev) => ({ ...prev, scope: "" }));
                  updateTaskSearchParams(selectedProgramId, next);
                }}
              >
                <option value="">{selectedProgramId ? "Select folder" : "Select program first"}</option>
                {foldersForSelectedProgram.map((f) => (
                  <option key={f._id} value={f._id}>
                    {folderOptionLabelById.get(String(f._id)) || f.name}
                  </option>
                ))}
              </select>

              <div className="task-side-progress mt-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small text-muted text-truncate">
                    {currentFolder
                      ? currentFolder.name
                      : currentProgram
                        ? `${programLabel(currentProgram)} selected`
                        : "No folder selected"}
                  </span>
                  <strong>{Math.round(taskProgress)}%</strong>
                </div>
                <div className="progress task-progress-rail">
                  <div className="progress-bar task-progress-bar" style={{ width: `${Math.max(0, Math.min(100, taskProgress))}%` }} />
                </div>
              </div>
            </div>

            <div className="task-side-card">
              <div className="task-side-title">Project Folders</div>
              <div className="task-folder-list">
                {!selectedProgramId && (
                  <div className="small text-muted">Select a program first.</div>
                )}
                {!!selectedProgramId && foldersForSelectedProgram.map((folder) => {
                  const folderId = String(folder?._id || "");
                  const active = folderId === String(currentFolderId);
                  return (
                    <button
                      key={folderId}
                      type="button"
                      className={`task-folder-item ${active ? "is-active" : ""}`}
                      onClick={() => {
                        setCurrentFolderId(folderId);
                        updateTaskSearchParams(selectedProgramId, folderId);
                      }}
                    >
                      {folderOptionLabelById.get(folderId) || folder.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasSelectedFolder && (
              <div className="task-side-card">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="task-side-title">Create Task</div>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    onClick={() => setShowCreateCard((prev) => !prev)}
                  >
                    {showCreateCard ? "Hide" : "Show"}
                  </button>
                </div>
                {showCreateCard && (
                  <>
                    <input
                      className="form-control form-control-sm mb-2"
                      placeholder="Task title"
                      value={taskDraft.title}
                      onChange={(e) => setTaskDraft((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <input
                      className="form-control form-control-sm mb-2"
                      placeholder={currentFolder?.name || "Scope"}
                      value={taskDraft.scope}
                      onChange={(e) => setTaskDraft((prev) => ({ ...prev, scope: e.target.value }))}
                    />
                    <textarea
                      className="form-control form-control-sm mb-2"
                      rows={3}
                      placeholder="Description"
                      value={taskDraft.comments}
                      onChange={(e) => setTaskDraft((prev) => ({ ...prev, comments: e.target.value }))}
                    />
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-primary"
                        type="button"
                        onClick={submitTask}
                        disabled={isSubmitting || !taskDraft.title.trim()}
                      >
                        <FaPlus className="me-1" />
                        {isSubmitting ? "Adding..." : "Add Task"}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        onClick={() => setTaskDraft({ title: "", scope: "", comments: "" })}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>

          <main className="task-hub-main">
            <div className="task-main-toolbar">
              <div className="input-group task-search-box">
                <span className="input-group-text"><FaSearch /></span>
                <input
                  className="form-control"
                  placeholder="Search task title, scope, description, or status"
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                />
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowCreateCard(true)}
                  disabled={!hasSelectedFolder}
                >
                  <FaPlus className="me-1" />
                  Add Task
                </button>
                <div className="input-group input-group-sm task-template-picker">
                  <select className="form-select" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                    <option value="copc_bsit">COPC BSIT</option>
                  </select>
                  <button className="btn btn-outline-primary" onClick={addSuggestedTasks} disabled={!hasSelectedFolder}>Suggest</button>
                </div>
              </div>
            </div>

            {!hasSelectedFolder && (
              <div className="task-board-empty">
                <FaFolder className="text-muted mb-2" size={30} />
                <h6 className="mb-1">Select a folder to open the Kanban board</h6>
                <div className="small text-muted">
                  Choose a program and folder from the left panel to view and manage tasks.
                </div>
              </div>
            )}

            {hasSelectedFolder && (
              <>
                <div className="task-board-summary">
                  Showing {filteredTaskSummary.total} of {taskSummary.total} task{taskSummary.total === 1 ? "" : "s"}
                </div>
                <div className="task-kanban-grid">
                  {BOARD_COLUMNS.map((column) => (
                    <section key={column.key} className={`task-kanban-column ${column.key}`}>
                      <div className="task-kanban-header">
                        <h6 className="mb-0">{column.title}</h6>
                        <span className="badge text-bg-light border">
                          {taskColumns[column.key].length}
                        </span>
                      </div>
                      <div className="task-kanban-list">
                        {taskColumns[column.key].length > 0 ? (
                          taskColumns[column.key].map((task, index) => (
                            <div key={`${String(task?._id || "task")}-${column.key}-${index}`}>
                              {renderTaskCard(task)}
                            </div>
                          ))
                        ) : (
                          <div className="task-kanban-empty">No tasks in this stage.</div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

    </div>
  );
}
