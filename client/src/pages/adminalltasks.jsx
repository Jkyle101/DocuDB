import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaExclamationTriangle,
  FaFileExport,
  FaFolderOpen,
  FaLayerGroup,
  FaListUl,
  FaRedoAlt,
  FaSearch,
  FaShieldAlt,
  FaTasks,
  FaUpload,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";
import "./adminalltasks.css";

const ITEMS_PER_PAGE = 6;

function clampPercent(value, fallback = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(100, Math.round(numeric)));
  return Math.max(0, Math.min(100, Math.round(Number(fallback) || 0)));
}

function normalizeRole(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "user";
  if (raw === "admin") return "superadmin";
  if (raw === "faculty") return "user";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  return raw;
}

function roleLabel(value) {
  const normalized = normalizeRole(value);
  const map = {
    superadmin: "Admin",
    qa_admin: "QA",
    dept_chair: "Department Chair",
    evaluator: "Evaluator",
    user: "Faculty",
  };
  return map[normalized] || normalized.replace(/_/g, " ").replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function formatProgramLabel(program) {
  const code = String(program?.code || program?.programCode || "").trim();
  const name = String(program?.name || program?.programName || "").trim();
  if (code && name && code !== name) return `${code} / ${name}`;
  return code || name || "Unassigned Program";
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(value) {
  if (!value) return "No recent updates";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "No recent updates";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(value);
}

function assigneeName(task) {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    return task.assignees
      .map((entry) => String(entry?.name || entry?.email || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return "Unassigned";
}

function assigneeInitials(task) {
  const source = assigneeName(task);
  if (source === "Unassigned") return "NA";
  const tokens = source.split(/[,\s]+/).filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

function taskStatusMeta(task) {
  if (task?.overdue) return { key: "overdue", label: "Overdue", className: "is-overdue" };
  const status = String(task?.status || task?.legacyStatus || "").toLowerCase();
  if (status === "approved" || status === "complete") {
    return { key: "approved", label: "Approved", className: "is-approved" };
  }
  if (status === "for_review") return { key: "for_review", label: "In Review", className: "is-review" };
  if (status === "rejected") return { key: "rejected", label: "Needs Revision", className: "is-rejected" };
  if (status === "in_progress") return { key: "in_progress", label: "In Progress", className: "is-progress" };
  return { key: "pending", label: "Pending", className: "is-pending" };
}

function taskStatusValue(task) {
  const status = String(task?.status || task?.legacyStatus || "").toLowerCase();
  if (status === "complete") return "approved";
  if (status === "not_started") return "pending";
  if (["pending", "in_progress", "for_review", "approved", "rejected"].includes(status)) return status;
  return "pending";
}

function taskProgress(task) {
  const fallback =
    task?.status === "approved" || task?.status === "complete"
      ? 100
      : task?.status === "for_review"
        ? 82
        : task?.status === "in_progress"
          ? 58
          : 18;
  return clampPercent(task?.percentage, fallback);
}

function hasEffectiveAssignment(task) {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) return true;
  const assignedRole = normalizeRole(task?.assignedRole || "");
  return ["user", "dept_chair", "qa_admin", "evaluator", "superadmin"].includes(assignedRole);
}

function toCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const header = [
    "Program",
    "Task ID",
    "Task Name",
    "Folder Path",
    "Assignee",
    "Role",
    "Status",
    "Progress",
    "Due Date",
    "Updated At",
  ];
  const lines = rows.map((row) =>
    [
      formatProgramLabel(row?.program),
      row?.taskId || "",
      row?.title || "",
      row?.folderPath || row?.folderName || "",
      assigneeName(row),
      roleLabel(row?.assignedRole),
      taskStatusMeta(row).label,
      `${taskProgress(row)}%`,
      formatDateShort(row?.dueDate),
      formatDateTime(row?.updatedAt || row?.createdAt),
    ]
      .map(toCsvValue)
      .join(",")
  );
  const content = [header.map(toCsvValue).join(","), ...lines].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toProgramMeta(program = {}, fallbackProgram = {}) {
  return {
    id: String(program?._id || program?.id || fallbackProgram?._id || fallbackProgram?.id || ""),
    code: String(program?.code || program?.programCode || fallbackProgram?.programCode || fallbackProgram?.code || fallbackProgram?.name || ""),
    name: String(program?.name || program?.programName || fallbackProgram?.programName || fallbackProgram?.name || ""),
    year: program?.year ?? fallbackProgram?.year ?? null,
  };
}

function sortTaskRows(rows = []) {
  return [...rows].sort((left, right) => {
    if (!!left?.overdue !== !!right?.overdue) return left?.overdue ? -1 : 1;
    const statusOrder = { overdue: 0, for_review: 1, in_progress: 2, pending: 3, rejected: 4, approved: 5 };
    const leftStatus = taskStatusMeta(left).key;
    const rightStatus = taskStatusMeta(right).key;
    if ((statusOrder[leftStatus] ?? 99) !== (statusOrder[rightStatus] ?? 99)) {
      return (statusOrder[leftStatus] ?? 99) - (statusOrder[rightStatus] ?? 99);
    }
    return (
      new Date(right?.updatedAt || right?.createdAt || 0).getTime() -
      new Date(left?.updatedAt || left?.createdAt || 0).getTime()
    );
  });
}

function rowsFromAssignedTasks(payload = {}, fallbackProgram = {}) {
  const program = toProgramMeta(payload?.program || {}, fallbackProgram);
  const folders = Array.isArray(payload?.folders) ? payload.folders : [];
  return folders.flatMap((folder) =>
    (Array.isArray(folder?.tasks) ? folder.tasks : []).map((task) => ({
      program,
      taskObjectId: String(task?.taskObjectId || task?._id || ""),
      taskId: String(task?.taskId || task?._id || ""),
      title: String(task?.title || "Untitled Task"),
      description: String(task?.description || ""),
      scope: String(task?.scope || ""),
      taskType: String(task?.taskType || "general"),
      priority: String(task?.priority || "medium"),
      status: String(task?.status || "pending"),
      legacyStatus: String(task?.legacyStatus || task?.status || "pending"),
      percentage: Number(task?.percentage || 0),
      dueDate: task?.dueDate || null,
      createdAt: task?.createdAt || null,
      updatedAt: task?.updatedAt || null,
      overdue: !!task?.overdue,
      depth: Number(task?.depth || 0),
      folderId: String(task?.folderId || folder?.folderId || ""),
      folderName: String(task?.folderName || folder?.folderName || "Untitled Folder"),
      folderPath: String(task?.folderPath || folder?.folderPath || folder?.folderName || ""),
      assignedRole: String(task?.assignedRole || ""),
      source: "assigned_tasks_fallback",
      assignees: Array.isArray(task?.assignees) ? task.assignees : [],
    }))
  );
}

export default function AdminAllTasksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = localStorage.getItem("role") || "superadmin";
  const normalizedRole = normalizeRole(role);
  const userId = localStorage.getItem("userId");
  const [programs, setPrograms] = useState([]);
  const [taskRows, setTaskRows] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(searchParams.get("programId") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTaskKey, setUpdatingTaskKey] = useState("");
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const isAdminContext = location.pathname.startsWith("/admin/");
  const dashboardBasePath = isAdminContext ? "/admin/copc-dashboard" : "/copc-dashboard";
  const breadcrumbLabel = useMemo(() => {
    if (isAdminContext) return "Admin / COPC Dashboard / Task Register";
    return `${roleLabel(normalizedRole)} / COPC Dashboard / Task Register`;
  }, [isAdminContext, normalizedRole]);
  const heroKicker = isAdminContext ? "COPC Admin Ledger" : "COPC Task Ledger";

  async function loadDashboard({ silent = false } = {}) {
    if (!userId) {
      setPrograms([]);
      setTaskRows([]);
      setGeneratedAt("");
      setError("Sign in again to load COPC task activity.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const programsRes = await axios.get(`${BACKEND_URL}/copc/programs`, {
        params: { userId, role },
      });
      const scopedPrograms = Array.isArray(programsRes.data) ? programsRes.data : [];
      setPrograms(scopedPrograms);

      const reportResults = await Promise.allSettled(
        scopedPrograms.map((program) =>
          axios.get(`${BACKEND_URL}/copc/programs/${program._id}/task-reports`, {
            params: { userId, role },
          })
        )
      );

      const rows = [];
      const timestamps = [];
      let failedReports = 0;
      const fallbackPrograms = [];

      reportResults.forEach((result, index) => {
        const fallbackProgram = scopedPrograms[index] || {};
        if (result.status !== "fulfilled") {
          failedReports += 1;
          fallbackPrograms.push(fallbackProgram);
          return;
        }
        const payload = result.value?.data || {};
        const reportProgram = toProgramMeta(payload?.program || {}, fallbackProgram);
        const hasStructuredRows = Array.isArray(payload?.allTasks);
        const items = hasStructuredRows ? payload.allTasks : [];
        if (!hasStructuredRows) {
          fallbackPrograms.push(fallbackProgram);
        }
        items.forEach((entry) => {
          rows.push({
            ...entry,
            program: entry?.program || reportProgram,
            assignees: Array.isArray(entry?.assignees) ? entry.assignees : [],
          });
        });
        if (payload?.generatedAt) timestamps.push(new Date(payload.generatedAt).getTime());
      });

      let fallbackFailures = 0;
      if (fallbackPrograms.length > 0) {
        const fallbackResults = await Promise.allSettled(
          fallbackPrograms.map((program) =>
            axios.get(`${BACKEND_URL}/copc/programs/${program._id}/assigned-tasks`, {
              params: { userId, role },
            })
          )
        );

        fallbackResults.forEach((result, index) => {
          if (result.status !== "fulfilled") {
            fallbackFailures += 1;
            return;
          }
          const fallbackProgram = fallbackPrograms[index] || {};
          const fallbackRows = rowsFromAssignedTasks(result.value?.data || {}, fallbackProgram);
          rows.push(...fallbackRows);
        });
      }

      const dedupedRows = Array.from(
        new Map(
          rows.map((row, index) => [
            `${row?.program?.id || "program"}:${row?.folderId || "folder"}:${row?.taskId || row?.title || index}`,
            row,
          ])
        ).values()
      );

      setTaskRows(sortTaskRows(dedupedRows));
      setGeneratedAt(timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString());

      const currentProgramId = String(searchParams.get("programId") || selectedProgramId || "");
      const stillExists = !currentProgramId || scopedPrograms.some((program) => String(program?._id || "") === currentProgramId);
      if (!stillExists) {
        const next = new URLSearchParams(searchParams);
        next.delete("programId");
        setSearchParams(next, { replace: true });
        setSelectedProgramId("");
      }

      if (failedReports > 0 || fallbackPrograms.length > 0) {
        if (dedupedRows.length > 0) {
          const totalFallbackIssues = failedReports + fallbackFailures;
          setError(
            totalFallbackIssues > 0
              ? `${totalFallbackIssues} COPC report request${totalFallbackIssues === 1 ? "" : "s"} used fallback task data.`
              : "Using fallback task data for programs that do not yet expose the new report payload."
          );
        } else if (scopedPrograms.length > 0) {
          setError("No task rows were returned from the COPC report endpoints.");
        }
      }
    } catch (err) {
      setPrograms([]);
      setTaskRows([]);
      setGeneratedAt("");
      setError(err?.response?.data?.error || "Failed to load the COPC task register.");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [role, userId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedProgramId, statusFilter, density]);

  useEffect(() => {
    const programIdFromUrl = searchParams.get("programId") || "";
    if (programIdFromUrl !== selectedProgramId) {
      setSelectedProgramId(programIdFromUrl);
    }
  }, [searchParams, selectedProgramId]);

  const scopedRows = taskRows.filter((row) => {
    if (!selectedProgramId) return true;
    return String(row?.program?.id || row?.program?._id || "") === String(selectedProgramId);
  });

  const filteredRows = scopedRows.filter((row) => {
    const statusKey = taskStatusMeta(row).key;
    if (statusFilter === "active" && ["approved", "rejected"].includes(statusKey)) return false;
    if (statusFilter === "overdue" && !row?.overdue) return false;
    if (!["all", "active", "overdue"].includes(statusFilter) && statusKey !== statusFilter) return false;

    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    const haystack = [
      row?.taskId,
      row?.title,
      row?.description,
      row?.folderPath,
      row?.folderName,
      row?.scope,
      assigneeName(row),
      formatProgramLabel(row?.program),
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(keyword);
  });

  const stats = {
    total: scopedRows.length,
    inProgress: scopedRows.filter((row) => taskStatusValue(row) === "in_progress").length,
    forReview: scopedRows.filter((row) => taskStatusValue(row) === "for_review").length,
    approved: scopedRows.filter((row) => taskStatusValue(row) === "approved").length,
    overdue: scopedRows.filter((row) => !!row?.overdue).length,
    assigned: scopedRows.filter((row) => hasEffectiveAssignment(row)).length,
  };
  stats.completionRate = stats.total ? clampPercent((stats.approved / stats.total) * 100) : 0;
  stats.assignmentCoverage = stats.total ? clampPercent((stats.assigned / stats.total) * 100) : 0;
  stats.deadlineHealth = stats.total ? clampPercent(((stats.total - stats.overdue) / stats.total) * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pagedRows = filteredRows.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const rangeStart = filteredRows.length ? pageStart + 1 : 0;
  const rangeEnd = filteredRows.length ? Math.min(pageStart + ITEMS_PER_PAGE, filteredRows.length) : 0;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const updateTaskStatus = async (row, nextStatus) => {
    const folderId = String(row?.folderId || "");
    const taskId = String(row?.taskObjectId || row?.taskId || "");
    const currentStatus = taskStatusValue(row);
    const targetStatus = String(nextStatus || "").trim().toLowerCase();
    if (!folderId || !taskId || !targetStatus || targetStatus === currentStatus) return;

    let comment = "";
    if (targetStatus === "rejected") {
      const promptValue = window.prompt("Add a rejection comment for this task:", "");
      if (promptValue === null) return;
      comment = String(promptValue || "").trim();
      if (!comment) {
        window.alert("A rejection comment is required.");
        return;
      }
    }

    const rowKey = `${String(row?.program?.id || "")}:${folderId}:${taskId}`;
    setUpdatingTaskKey(rowKey);
    setError("");
    try {
      await axios.patch(`${BACKEND_URL}/folders/${folderId}/tasks/${taskId}/check`, {
        userId,
        role,
        status: targetStatus,
        comment: comment || undefined,
      });
      await loadDashboard({ silent: true });
    } catch (err) {
      const message = err?.response?.data?.error || "Failed to update task status.";
      setError(message);
      window.alert(message);
    } finally {
      setUpdatingTaskKey("");
    }
  };

  const activityItems = [...scopedRows]
    .sort(
      (left, right) =>
        new Date(right?.updatedAt || right?.createdAt || 0).getTime() -
        new Date(left?.updatedAt || left?.createdAt || 0).getTime()
    )
    .slice(0, 4);

  const shortcuts = isAdminContext
    ? [
        { label: "Workflow", icon: FaLayerGroup, onClick: () => navigate("/admin/copc-dashboard?tab=workflow") },
        { label: "Task Board", icon: FaTasks, onClick: () => navigate("/admin/tasks") },
        { label: "Uploads", icon: FaUpload, onClick: () => navigate("/admin/copc-recent-uploads") },
        { label: "Programs", icon: FaFolderOpen, onClick: () => navigate("/admin/copc-programs") },
      ]
    : [
        { label: "Workflow", icon: FaLayerGroup, onClick: () => navigate(`${dashboardBasePath}?tab=workflow`) },
        { label: "My Tasks", icon: FaTasks, onClick: () => navigate(`${dashboardBasePath}?tab=tasks`) },
        { label: "Task Board", icon: FaListUl, onClick: () => navigate(`${dashboardBasePath}?tab=task_management`) },
        { label: "Review", icon: FaCheckCircle, onClick: () => navigate(`${dashboardBasePath}?tab=department_review`) },
      ];

  const tableCountLabel = `${filteredRows.length} item${filteredRows.length === 1 ? "" : "s"}`;

  return (
    <div className="copc-all-tasks-page">
      <div className="copc-all-tasks-topline">
        <div className="copc-all-tasks-breadcrumb">{breadcrumbLabel}</div>
        <label className="copc-all-tasks-search">
          <FaSearch />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks, folders, assignees..."
          />
        </label>
      </div>

      <section className="copc-all-tasks-hero">
        <div>
          <div className="copc-all-tasks-kicker">{heroKicker}</div>
          <h2 className="copc-all-tasks-title">All Tasks Register</h2>
          <p className="copc-all-tasks-copy">
            Reimagined oversight view for every COPC task, with live scope filters, task health,
            exportable reporting, and direct links to the working folder board.
          </p>
          <div className="copc-all-tasks-hero-meta">
            <span className="copc-all-tasks-mini-pill">{programs.length} programs</span>
            <span className="copc-all-tasks-mini-pill">{stats.total} scoped tasks</span>
            <span className="copc-all-tasks-mini-pill">
              {generatedAt ? `Updated ${formatRelativeTime(generatedAt)}` : "Waiting for sync"}
            </span>
          </div>
        </div>

        <div className="copc-all-tasks-hero-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => downloadCsv(`copc-task-register-${Date.now()}.csv`, filteredRows)}
            disabled={loading || filteredRows.length === 0}
          >
            <FaFileExport className="me-2" />
            Export Report
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => loadDashboard({ silent: true })}
            disabled={loading || refreshing}
          >
            <FaRedoAlt className={`me-2 ${refreshing ? "copc-all-tasks-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync Ledger"}
          </button>
        </div>
      </section>

      <section className="copc-all-tasks-summary-grid" aria-label="Task register summary">
        <article className="copc-all-tasks-summary-card tone-total">
          <div className="copc-all-tasks-summary-label">Total Tasks</div>
          <div className="copc-all-tasks-summary-value">{stats.total}</div>
          <div className="copc-all-tasks-summary-note">{stats.assignmentCoverage}% assignment coverage</div>
        </article>
        <article className="copc-all-tasks-summary-card tone-progress">
          <div className="copc-all-tasks-summary-label">In Progress</div>
          <div className="copc-all-tasks-summary-value">{stats.inProgress}</div>
          <div className="copc-all-tasks-summary-note">Active execution across folders</div>
        </article>
        <article className="copc-all-tasks-summary-card tone-review">
          <div className="copc-all-tasks-summary-label">For Review</div>
          <div className="copc-all-tasks-summary-value">{stats.forReview}</div>
          <div className="copc-all-tasks-summary-note">Queued for admin and QA validation</div>
        </article>
        <article className="copc-all-tasks-summary-card tone-approved">
          <div className="copc-all-tasks-summary-label">Approved</div>
          <div className="copc-all-tasks-summary-value">{stats.approved}</div>
          <div className="copc-all-tasks-summary-note">{stats.completionRate}% completion rate</div>
        </article>
        <article className="copc-all-tasks-summary-card tone-overdue">
          <div className="copc-all-tasks-summary-label">Overdue</div>
          <div className="copc-all-tasks-summary-value">{stats.overdue}</div>
          <div className="copc-all-tasks-summary-note">{stats.deadlineHealth}% deadline health</div>
        </article>
      </section>

      <div className="copc-all-tasks-shell">
        <div className="copc-all-tasks-main">
          <section className="copc-all-tasks-filterbar">
            <div className="copc-all-tasks-field">
              <label htmlFor="copc-all-tasks-program">Program Scope</label>
              <select
                id="copc-all-tasks-program"
                value={selectedProgramId}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSelectedProgramId(nextValue);
                  const next = new URLSearchParams(searchParams);
                  if (nextValue) next.set("programId", nextValue);
                  else next.delete("programId");
                  setSearchParams(next, { replace: true });
                }}
              >
                <option value="">All Programs</option>
                {programs.map((program) => (
                  <option key={String(program?._id || "")} value={String(program?._id || "")}>
                    {formatProgramLabel(program)}
                  </option>
                ))}
              </select>
            </div>

            <div className="copc-all-tasks-field">
              <label htmlFor="copc-all-tasks-status">Status</label>
              <select
                id="copc-all-tasks-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="active">Active Only</option>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="for_review">For Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Needs Revision</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div className="copc-all-tasks-view-switch" role="group" aria-label="Table density">
              <button
                type="button"
                className={`copc-all-tasks-iconbtn ${density === "comfortable" ? "is-active" : ""}`}
                onClick={() => setDensity("comfortable")}
                title="Comfortable rows"
              >
                <FaListUl />
              </button>
              <button
                type="button"
                className={`copc-all-tasks-iconbtn ${density === "compact" ? "is-active" : ""}`}
                onClick={() => setDensity("compact")}
                title="Compact rows"
              >
                <FaLayerGroup />
              </button>
            </div>
          </section>

          <section className="copc-all-tasks-table-card">
            <div className="copc-all-tasks-table-head">
              <div>
                <div className="copc-all-tasks-table-title">Task Register</div>
                <div className="copc-all-tasks-table-note">
                  Review every folder task from a single command surface and jump into the task board when you need detail.
                </div>
              </div>
              <div className="copc-all-tasks-table-count">{tableCountLabel}</div>
            </div>

            {error ? <div className="alert alert-warning mb-0 mx-3 mt-3">{error}</div> : null}

            {loading ? (
              <div className="copc-all-tasks-empty">
                <div className="spinner-border text-primary mb-3" role="status" />
                <div>Loading COPC task ledger...</div>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="copc-all-tasks-empty">
                <FaTasks className="copc-all-tasks-empty-icon" />
                <div className="copc-all-tasks-empty-title">No tasks match this view.</div>
                <div>Try another program scope, status filter, or search keyword.</div>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className={`table copc-all-tasks-table ${density === "compact" ? "is-compact" : ""}`}>
                    <thead>
                      <tr>
                        <th>Task Name</th>
                        <th>Folder Path</th>
                        <th>Assignee</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, index) => {
                        const statusMeta = taskStatusMeta(row);
                        const progress = taskProgress(row);
                        const firstAssignee = Array.isArray(row?.assignees) ? row.assignees[0] : null;
                        const extraAssignees = Math.max(0, Number(row?.assignees?.length || 0) - 1);
                        const rowKey = `${String(row?.program?.id || "")}:${String(row?.folderId || "")}:${String(row?.taskId || "")}`;
                        const isUpdatingStatus = updatingTaskKey === rowKey;
                        return (
                          <tr key={`${row?.folderId || "folder"}-${row?.taskId || row?.title || index}`}>
                            <td>
                              <div className="copc-all-task-title">{row?.title || "Untitled Task"}</div>
                              <div className="copc-all-task-subtitle">ID: {row?.taskId || "N/A"}</div>
                              {row?.description ? <div className="copc-all-task-description">{row.description}</div> : null}
                            </td>
                            <td>
                              <div className="copc-all-task-folder">{row?.folderPath || row?.folderName || "Root Folder"}</div>
                              <div className="copc-all-task-subtitle">{formatProgramLabel(row?.program)}</div>
                            </td>
                            <td>
                              <div className="copc-all-task-assignee">
                                <span className="copc-all-task-avatar">{assigneeInitials(row)}</span>
                                <div>
                                  <div className="copc-all-task-assignee-name">
                                    {firstAssignee?.name || firstAssignee?.email || "Unassigned"}
                                    {extraAssignees > 0 ? ` +${extraAssignees}` : ""}
                                  </div>
                                  <div className="copc-all-task-subtitle">
                                    {firstAssignee ? roleLabel(firstAssignee?.role || row?.assignedRole) : roleLabel(row?.assignedRole)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className={`copc-all-task-status ${statusMeta.className}`}>{statusMeta.label}</div>
                              <div className="copc-all-task-progress">
                                <div className="copc-all-task-progress-bar" style={{ width: `${progress}%` }} />
                              </div>
                              <div className="copc-all-task-subtitle">{progress}% complete</div>
                            </td>
                            <td>
                              <label className="copc-all-task-action-label">
                                <span>Change status</span>
                                <select
                                  className="copc-all-task-status-select"
                                  value={taskStatusValue(row)}
                                  onChange={(event) => updateTaskStatus(row, event.target.value)}
                                  disabled={isUpdatingStatus}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="for_review">For Review</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                              </label>
                              {isUpdatingStatus ? (
                                <div className="copc-all-task-action-note">Saving...</div>
                              ) : (
                                <div className="copc-all-task-action-note">Status control</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="copc-all-tasks-table-footer">
                  <div>
                    Showing {rangeStart} to {rangeEnd} of {filteredRows.length} tasks
                  </div>
                  <div className="copc-all-tasks-pagination">
                    <button
                      type="button"
                      className="copc-all-tasks-pagebtn"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={safePage <= 1}
                    >
                      <FaChevronLeft />
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1)
                      .slice(Math.max(0, safePage - 2), Math.max(0, safePage - 2) + 3)
                      .map((page) => (
                        <button
                          key={page}
                          type="button"
                          className={`copc-all-tasks-pagebtn ${page === safePage ? "is-active" : ""}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                    <button
                      type="button"
                      className="copc-all-tasks-pagebtn"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={safePage >= totalPages}
                    >
                      <FaChevronRight />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="copc-all-tasks-side">
          <section className="copc-all-tasks-sidecard">
            <div className="copc-all-tasks-sidehead">
              <span>Admin Activity</span>
              <FaClock />
            </div>
            <div className="copc-all-tasks-activity">
              {activityItems.length === 0 ? (
                <div className="copc-all-tasks-sideempty">No recent task activity yet.</div>
              ) : (
                activityItems.map((row) => {
                  const statusMeta = taskStatusMeta(row);
                  return (
                    <div className="copc-all-tasks-activity-item" key={`activity-${row?.taskId || row?.title}`}>
                      <span className={`copc-all-tasks-activity-dot ${statusMeta.className}`} />
                      <div>
                        <div className="copc-all-tasks-activity-title">{row?.title || "Untitled Task"}</div>
                        <div className="copc-all-tasks-activity-copy">
                          {formatProgramLabel(row?.program)} / {statusMeta.label}
                        </div>
                        <div className="copc-all-tasks-activity-time">
                          {formatRelativeTime(row?.updatedAt || row?.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="copc-all-tasks-sidecard copc-all-tasks-shortcuts">
            <div className="copc-all-tasks-sidehead">
              <span>System Shortcuts</span>
              <FaShieldAlt />
            </div>
            <div className="copc-all-tasks-shortcut-grid">
              {shortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                return (
                  <button key={shortcut.label} type="button" className="copc-all-tasks-shortcut" onClick={shortcut.onClick}>
                    <Icon />
                    <span>{shortcut.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="copc-all-tasks-sidecard">
            <div className="copc-all-tasks-sidehead">
              <span>Ledger Health</span>
              <FaCheckCircle />
            </div>
            <div className="copc-all-tasks-health-row">
              <div>
                <div className="copc-all-tasks-health-label">Sync Integrity</div>
                <div className="copc-all-tasks-health-value">{stats.completionRate}%</div>
              </div>
              <div className="copc-all-tasks-health-bar">
                <span style={{ width: `${stats.completionRate}%` }} />
              </div>
            </div>
            <div className="copc-all-tasks-health-row">
              <div>
                <div className="copc-all-tasks-health-label">Assignment Coverage</div>
                <div className="copc-all-tasks-health-value">{stats.assignmentCoverage}%</div>
              </div>
              <div className="copc-all-tasks-health-bar">
                <span style={{ width: `${stats.assignmentCoverage}%` }} />
              </div>
            </div>
            <div className="copc-all-tasks-health-row">
              <div>
                <div className="copc-all-tasks-health-label">Deadline Health</div>
                <div className="copc-all-tasks-health-value">{stats.deadlineHealth}%</div>
              </div>
              <div className="copc-all-tasks-health-bar">
                <span style={{ width: `${stats.deadlineHealth}%` }} />
              </div>
            </div>
          </section>

          <section className="copc-all-tasks-sidecard copc-all-tasks-sideaccent">
            <div className="copc-all-tasks-sidehead">
              <span>Priority Watch</span>
              <FaExclamationTriangle />
            </div>
            <div className="copc-all-tasks-watch-value">{stats.overdue}</div>
            <div className="copc-all-tasks-watch-copy">
              overdue task{stats.overdue === 1 ? "" : "s"} need follow-up across the selected COPC scope.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
