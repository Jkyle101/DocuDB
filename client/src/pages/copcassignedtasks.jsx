import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaCheckCircle, FaClock, FaFolderOpen, FaTasks } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../config";
import "./task-management.css";

const STATUS_META = {
  pending: { label: "Pending", className: "bg-secondary" },
  in_progress: { label: "In Progress", className: "bg-warning text-dark" },
  approved: { label: "Approved", className: "bg-success" },
};
const LEGACY_STATUS_MAP = {
  not_started: "pending",
  complete: "approved",
};

const normalizeTaskStatus = (value) => {
  const key = String(value || "").toLowerCase();
  const normalized = LEGACY_STATUS_MAP[key] || key || "pending";
  if (normalized === "for_review" || normalized === "rejected") return "in_progress";
  return normalized;
};

const emptySummary = {
  folders: 0,
  totalTasks: 0,
  pending: 0,
  inProgress: 0,
  forReview: 0,
  approved: 0,
  rejected: 0,
  overdue: 0,
  // Legacy aliases for old payloads
  notStarted: 0,
  complete: 0,
};

const ASSIGNED_KANBAN_COLUMNS = [
  { key: "pending", title: "To Do", emptyLabel: "No pending tasks." },
  { key: "in_progress", title: "In Progress", emptyLabel: "No tasks in progress." },
  { key: "approved", title: "Approved", emptyLabel: "No approved tasks yet." },
];

const roleLabel = (role) => {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "dept_chair") return "Department Chair";
  if (normalized === "qa_admin") return "QA Admin";
  if (normalized === "evaluator") return "Evaluator";
  if (normalized === "superadmin") return "Super Admin";
  return "Uploader";
};

const assignmentSourceLabel = (sources = [], role = "") => {
  const labels = [];
  if ((sources || []).includes("folder_scope")) labels.push(`${roleLabel(role)} Scope`);
  if ((sources || []).includes("task_direct")) labels.push("Task Direct");
  if (!labels.length) labels.push("Assigned");
  return labels.join(", ");
};

const programLabel = (program) => {
  const code = String(program?.programCode || "").trim();
  const name = String(program?.programName || program?.name || "").trim();
  const year = program?.year ? ` (${program.year})` : "";
  if (code && name && code !== name) return `${code} - ${name}${year}`;
  return `${name || code || "Program"}${year}`;
};

export default function CopcAssignedTasksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedProgramId = String(searchParams.get("programId") || "");
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [assignedByFolder, setAssignedByFolder] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [actorRole, setActorRole] = useState("");
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");

  const loadPrograms = async () => {
    setLoadingPrograms(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, {
        params: { userId, role },
      });
      const list = Array.isArray(data) ? data : [];
      setPrograms(list);

      const requestedExists =
        requestedProgramId && list.some((program) => String(program._id) === requestedProgramId);
      const selectedExists =
        selectedProgramId && list.some((program) => String(program._id) === String(selectedProgramId));
      if (requestedExists) {
        setSelectedProgramId(requestedProgramId);
        return;
      }
      if (!selectedExists) {
        setSelectedProgramId(list.length > 0 ? String(list[0]._id) : "");
      }
    } finally {
      setLoadingPrograms(false);
    }
  };

  const loadAssignedTasks = async (programId) => {
    if (!programId) {
      setAssignedByFolder([]);
      setSummary(emptySummary);
      setActorRole("");
      return;
    }

    setLoadingTasks(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/assigned-tasks`, {
        params: { userId, role },
      });
      setAssignedByFolder(Array.isArray(data?.folders) ? data.folders : []);
      setSummary(
        data?.summary || emptySummary
      );
      setActorRole(String(data?.role || ""));
    } catch {
      setAssignedByFolder([]);
      setSummary(emptySummary);
      setActorRole("");
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadPrograms().catch(() => {
      setPrograms([]);
      setSelectedProgramId("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!requestedProgramId) return;
    const exists = programs.some((item) => String(item._id) === requestedProgramId);
    if (exists) setSelectedProgramId(requestedProgramId);
  }, [requestedProgramId, programs]);

  useEffect(() => {
    loadAssignedTasks(selectedProgramId).catch(() => {
      setAssignedByFolder([]);
      setSummary(emptySummary);
      setActorRole("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  const filteredFolders = useMemo(() => {
    const query = String(taskQuery || "").trim().toLowerCase();
    if (!query) return assignedByFolder;

    return assignedByFolder
      .map((folder) => {
        const folderName = String(folder?.folderName || "").toLowerCase();
        const folderPath = String(folder?.folderPath || "").toLowerCase();
        const matchedTasks = (folder?.tasks || []).filter((task) => {
          const title = String(task?.title || "").toLowerCase();
          const scope = String(task?.scope || "").toLowerCase();
          const description = String(task?.description || "").toLowerCase();
          const status = String(task?.status || "").toLowerCase();
          return (
            title.includes(query) ||
            scope.includes(query) ||
            description.includes(query) ||
            status.includes(query)
          );
        });

        const folderMatched = folderName.includes(query) || folderPath.includes(query);
        if (folderMatched) return folder;
        if (!matchedTasks.length) return null;
        return { ...folder, tasks: matchedTasks };
      })
      .filter(Boolean);
  }, [assignedByFolder, taskQuery]);

  const assignedTasks = useMemo(() => {
    const rows = [];
    for (const folder of filteredFolders) {
      for (const task of folder?.tasks || []) {
        const normalizedStatus = normalizeTaskStatus(task?.status);
        rows.push({
          ...task,
          status: normalizedStatus,
          folderId: String(task?.folderId || folder?.folderId || ""),
          folderName: String(task?.folderName || folder?.folderName || "Untitled Folder"),
          folderPath: String(task?.folderPath || folder?.folderPath || folder?.folderName || "Folder"),
          assignmentLabel: assignmentSourceLabel(task?.assignmentSources, actorRole),
        });
      }
    }
    return rows.sort((a, b) => {
      const aDue = a?.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b?.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return String(a?.folderPath || "").localeCompare(String(b?.folderPath || ""));
    });
  }, [filteredFolders, actorRole]);

  const assignedTasksByStatus = useMemo(() => {
    const grouped = Object.fromEntries(ASSIGNED_KANBAN_COLUMNS.map((column) => [column.key, []]));
    for (const task of assignedTasks) {
      const status = ASSIGNED_KANBAN_COLUMNS.some((column) => column.key === task.status)
        ? task.status
        : "pending";
      grouped[status].push(task);
    }
    return grouped;
  }, [assignedTasks]);

  const inProgressDisplayCount = Number(summary.inProgress || 0) + Number(summary.forReview || 0) + Number(summary.rejected || 0);

  const openFolderInUploadWorkspace = (folderId) => {
    const params = new URLSearchParams();
    params.set("tab", "upload");
    if (selectedProgramId) params.set("programId", String(selectedProgramId));
    if (folderId) params.set("folderId", String(folderId));
    navigate(`/copc-dashboard?${params.toString()}`);
  };

  return (
    <div className="container-fluid py-3 task-assigned-page">
      <div className="assigned-hero card shadow-sm mb-3">
        <div className="card-body d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div className="d-flex align-items-center gap-2">
            <FaTasks className="text-success" />
            <div>
              <h4 className="mb-1">Tasks Assigned to Me</h4>
              <div className="small text-muted">Review your folder assignments and jump straight to upload workspaces.</div>
            </div>
          </div>
          <span className="badge text-bg-light border">{summary.totalTasks} assigned task{summary.totalTasks === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-lg-7">
              <label className="form-label small fw-semibold">Program</label>
              <select
                className="form-select"
                value={selectedProgramId}
                onChange={(event) => setSelectedProgramId(event.target.value)}
                disabled={loadingPrograms}
              >
                <option value="">{loadingPrograms ? "Loading programs..." : "Select Program"}</option>
                {programs.map((program) => (
                  <option key={program._id} value={program._id}>
                    {programLabel(program)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-5">
              <label className="form-label small fw-semibold">Search Assigned Tasks</label>
              <input
                className="form-control"
                placeholder="Search folder, task, scope, or status"
                value={taskQuery}
                onChange={(event) => setTaskQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {!selectedProgramId && (
        <div className="alert alert-info">Select a COPC program to view your assigned tasks.</div>
      )}

      {selectedProgramId && (
        <div className="row g-2 mb-3">
          <div className="col-sm-6 col-md-3">
            <div className="card shadow-sm h-100 assigned-summary-card">
              <div className="card-body py-2">
                <div className="small text-muted">Folders</div>
                <div className="fw-bold fs-4">{summary.folders}</div>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-3">
            <div className="card shadow-sm h-100 assigned-summary-card">
              <div className="card-body py-2">
                <div className="small text-muted">Assigned Tasks</div>
                <div className="fw-bold fs-4">{summary.totalTasks}</div>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-2">
            <div className="card shadow-sm h-100 assigned-summary-card">
              <div className="card-body py-2">
                <div className="small text-muted">Approved</div>
                <div className="fw-bold fs-4 text-success">{summary.approved ?? summary.complete}</div>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-2">
            <div className="card shadow-sm h-100 assigned-summary-card">
              <div className="card-body py-2">
                <div className="small text-muted">In Progress</div>
                <div className="fw-bold fs-4 text-warning">{inProgressDisplayCount}</div>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-2">
            <div className="card shadow-sm h-100 assigned-summary-card">
              <div className="card-body py-2">
                <div className="small text-muted">Pending</div>
                <div className="fw-bold fs-4 text-secondary">{summary.pending ?? summary.notStarted}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loadingTasks && selectedProgramId && <div className="small text-muted">Loading your assigned tasks...</div>}

      {!loadingTasks && selectedProgramId && filteredFolders.length === 0 && (
        <div className="text-center py-5">
          <FaClock className="text-muted mb-2" size={40} />
          <div className="small text-muted">No assigned COPC tasks found in this program.</div>
        </div>
      )}

      {!loadingTasks && selectedProgramId && filteredFolders.length > 0 && (
        <>
          <div className="assigned-board-meta small text-muted mb-2">
            Showing {assignedTasks.length} task{assignedTasks.length === 1 ? "" : "s"} across {filteredFolders.length} folder{filteredFolders.length === 1 ? "" : "s"}.
          </div>
          <div className="assigned-kanban-wrap">
            <div className="assigned-kanban-grid">
              {ASSIGNED_KANBAN_COLUMNS.map((column) => (
                <section key={column.key} className={`assigned-kanban-column ${column.key}`}>
                  <div className="assigned-kanban-header">
                    <h6 className="mb-0">{column.title}</h6>
                    <span className="badge text-bg-light border">
                      {assignedTasksByStatus[column.key]?.length || 0}
                    </span>
                  </div>
                  <div className="assigned-kanban-list">
                    {(assignedTasksByStatus[column.key] || []).length > 0 ? (
                      (assignedTasksByStatus[column.key] || []).map((task, index) => {
                        const statusMeta = STATUS_META[String(task?.status || "")] || STATUS_META.pending;
                        const taskFolderId = String(task?.folderId || "");
                        const taskFolderLabel = String(task?.folderPath || task?.folderName || "Folder");
                        return (
                          <article key={`${String(task.taskId || "task")}-${column.key}-${index}`} className={`assigned-task-card status-${column.key}`}>
                            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                              <span className={`badge ${statusMeta.className}`}>{statusMeta.label}</span>
                              <span className="badge text-bg-light border">
                                {Math.round(Number(task?.percentage || 0))}%
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-link p-0 text-start fw-semibold assigned-task-link"
                              onClick={() => openFolderInUploadWorkspace(taskFolderId)}
                              title={`Open folder: ${taskFolderLabel}`}
                            >
                              {task.title || "Untitled Task"}
                            </button>
                            <div className="small text-muted mt-1">
                              Folder: {taskFolderLabel}
                            </div>
                            {!!task.scope && <div className="small text-muted">Scope: {task.scope}</div>}
                            {!!task.description && (
                              <div className="small text-muted assigned-task-description mt-1" title={task.description}>
                                {task.description}
                              </div>
                            )}
                            <div className="small text-muted mt-2">
                              {String(task?.taskType || "general").replace("_", " ")} | {String(task?.priority || "medium")}
                              {task?.dueDate ? ` | Due: ${new Date(task.dueDate).toLocaleDateString()}` : ""}
                            </div>
                            <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
                              <span className="badge text-bg-light border">{task.assignmentLabel}</span>
                              <button
                                className="btn btn-sm btn-outline-success"
                                type="button"
                                onClick={() => openFolderInUploadWorkspace(taskFolderId)}
                              >
                                <FaFolderOpen className="me-1" />
                                Open
                              </button>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="assigned-kanban-empty small text-muted">
                        {column.emptyLabel}
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
