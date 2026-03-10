import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaCheckCircle, FaFolder, FaListUl, FaPlus, FaTrashAlt, FaUsers } from "react-icons/fa";
import { BACKEND_URL } from "../config";

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

const emptyAssignments = { uploaders: [], programChairs: [], qaOfficers: [] };

export default function AdminTasksPage() {
  const role = localStorage.getItem("role") || "superadmin";
  const userId = localStorage.getItem("userId");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProgramId = searchParams.get("programId") || "";
  const initialFolderId = searchParams.get("folderId") || "";

  const [folders, setFolders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(initialProgramId);
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [folderTasks, setFolderTasks] = useState([]);
  const [taskProgress, setTaskProgress] = useState(0);
  const [templateKey, setTemplateKey] = useState("copc_bsit");
  const [assignments, setAssignments] = useState(emptyAssignments);
  const [assignmentPool, setAssignmentPool] = useState({ uploaders: [], programChairs: [], qaOfficers: [], evaluators: [] });
  const [listedUploadersByFolder, setListedUploadersByFolder] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignModal, setAssignModal] = useState({
    open: false,
    scopeKey: "uploaders",
    title: "Assign Users",
    selectedIds: [],
    search: "",
    candidateUsers: [],
  });
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    scope: "",
    comments: "",
  });

  const updateTaskSearchParams = useCallback(
    (programId, folderId) => {
      const next = {};
      if (programId) next.programId = String(programId);
      if (folderId) next.folderId = String(folderId);
      setSearchParams(next);
    },
    [setSearchParams]
  );

  const normalizeRole = (value) => {
    const raw = String(value || "").toLowerCase();
    if (raw === "admin") return "superadmin";
    if (raw === "user") return "faculty";
    if (["program_chair", "department_chair", "program_head", "dept_chair"].includes(raw)) return "dept_chair";
    if (["qa_officer", "quality_assurance_admin", "copc_reviewer", "qa_admin"].includes(raw)) return "qa_admin";
    if (raw === "reviewer") return "evaluator";
    return raw;
  };

  const roleLabel = (value) => {
    const key = normalizeRole(value);
    if (key === "superadmin") return "Super Admin";
    if (key === "qa_admin") return "QA Admin";
    if (key === "dept_chair") return "Dept Chair";
    if (key === "faculty") return "Faculty";
    if (key === "evaluator") return "Evaluator";
    return value;
  };

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

  const loadUsers = useCallback(async () => {
    const { data } = await axios.get(`${BACKEND_URL}/users`, { params: { role, userId } });
    setUsers(Array.isArray(data) ? data : []);
  }, [role, userId]);

  const loadTasks = useCallback(
    async (folderId) => {
      if (!folderId) {
        setFolderTasks([]);
        setTaskProgress(0);
        setAssignments(emptyAssignments);
        setAssignmentPool({ uploaders: [], programChairs: [], qaOfficers: [], evaluators: [] });
        return;
      }
      const { data } = await axios.get(`${BACKEND_URL}/folders/${folderId}/tasks`, {
        params: { userId, role },
      });
      setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      setTaskProgress(Number(data?.progress || 0));
      const nextAssignments = data?.assignments || emptyAssignments;
      const nextPool = data?.assignmentPool || { uploaders: [], programChairs: [], qaOfficers: [], evaluators: [] };
      setAssignments(nextAssignments);
      setAssignmentPool(nextPool);
      const incomingUploaders = Array.isArray(nextPool.uploaders) ? nextPool.uploaders : [];
      setListedUploadersByFolder((prev) => {
        const key = String(folderId);
        const existing = Array.isArray(prev[key]) ? prev[key] : [];
        const merged = [...existing, ...incomingUploaders];
        const dedup = new Map();
        merged.forEach((u) => {
          const id = String(u?._id || "");
          if (id) dedup.set(id, u);
        });
        return { ...prev, [key]: Array.from(dedup.values()) };
      });
    },
    [role, userId]
  );

  useEffect(() => {
    loadFolders().catch(() => setFolders([]));
    loadUsers().catch(() => setUsers([]));
  }, [loadFolders, loadUsers]);

  useEffect(() => {
    loadTasks(currentFolderId).catch(() => {
      setFolderTasks([]);
      setTaskProgress(0);
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

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(String(u._id), u));
    return map;
  }, [users]);

  const poolUsersByScope = useMemo(() => {
    const currentKey = String(currentFolderId || "");
    const sticky = Array.isArray(listedUploadersByFolder[currentKey]) ? listedUploadersByFolder[currentKey] : [];
    const incoming = Array.isArray(assignmentPool?.uploaders) ? assignmentPool.uploaders : [];
    const dedup = new Map();
    [...sticky, ...incoming].forEach((u) => {
      const id = String(u?._id || "");
      if (id) dedup.set(id, u);
    });
    return {
      uploaders: Array.from(dedup.values()),
    };
  }, [assignmentPool, listedUploadersByFolder, currentFolderId]);

  const poolUsersById = useMemo(() => {
    const map = new Map();
    Object.values(poolUsersByScope)
      .flat()
      .forEach((u) => {
        if (u?._id) map.set(String(u._id), u);
      });
    return map;
  }, [poolUsersByScope]);

  const selectedLabel = (id) => {
    const user = usersById.get(String(id)) || poolUsersById.get(String(id));
    if (!user) return "Unknown user";
    return `${user.name || user.email} (${roleLabel(user.role)})`;
  };

  const openAssignModal = (scopeKey, title) => {
    const selectedIds = (assignments[scopeKey] || []).map((u) => String(u?._id || u));
    const candidateUsers = poolUsersByScope[scopeKey] || [];
    setAssignModal({
      open: true,
      scopeKey,
      title,
      selectedIds,
      search: "",
      candidateUsers,
    });
  };

  const closeAssignModal = () => {
    setAssignModal((prev) => ({ ...prev, open: false }));
  };

  const toggleModalUser = (id) => {
    const raw = String(id);
    setAssignModal((prev) => {
      const exists = prev.selectedIds.includes(raw);
      return {
        ...prev,
        selectedIds: exists
          ? prev.selectedIds.filter((x) => x !== raw)
          : [...prev.selectedIds, raw],
      };
    });
  };

  const modalUsers = useMemo(() => {
    const query = String(assignModal.search || "").trim().toLowerCase();
    const list = Array.isArray(assignModal.candidateUsers) ? assignModal.candidateUsers : [];
    if (!query) return list;
    return list.filter((u) => {
      const name = String(u?.name || "").toLowerCase();
      const email = String(u?.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [assignModal.candidateUsers, assignModal.search]);

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

  const removeTask = async (taskId) => {
    if (!currentFolderId || !taskId) return;
    const { data } = await axios.delete(`${BACKEND_URL}/folders/${currentFolderId}/tasks/${taskId}`, {
      data: { userId, role },
    });
    setFolderTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    setTaskProgress(Number(data?.progress || 0));
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSuggestedTasks = async () => {
    if (!currentFolderId) return;
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
  };

  const saveAssignments = async (nextAssignments) => {
    setAssignments(nextAssignments);
    await axios.patch(`${BACKEND_URL}/folders/${currentFolderId}/assignments`, {
      userId,
      role,
      assignments: nextAssignments,
    });
  };

  const onAssignmentChange = (key, values) => {
    return saveAssignments({ ...assignments, [key]: values });
  };

  const applyAssignModal = async () => {
    try {
      await onAssignmentChange(assignModal.scopeKey, assignModal.selectedIds);
      closeAssignModal();
    } catch {
      // Keep modal open if save fails.
    }
  };

  const renderAssigneeBadges = (values = [], scopeKey = "task") => {
    const ids = values.map((v) => String(v?._id || v));
    if (!ids.length) return <div className="small text-muted">No assigned users.</div>;
    return (
      <div className="d-flex flex-wrap gap-2 mt-2">
        {ids.map((id) => (
          <span key={`${scopeKey}-${id}`} className="badge text-bg-light border">
            {selectedLabel(id)}
          </span>
        ))}
      </div>
    );
  };

  const renderTasks = (tasks = []) => (
    <ul className="list-group list-group-flush">
      {tasks.map((task) => {
        const done = Number(task.percentage || 0) >= 100 || task.status === "complete";
        return (
          <li key={task._id} className="list-group-item px-0 border-0 py-2">
            <div className="d-flex justify-content-between align-items-center gap-2">
              <div className="d-flex align-items-center gap-2">
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: done ? "none" : "2px solid #c7c7c7",
                    background: done ? "#45be57" : "transparent",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {done ? "v" : ""}
                </div>
                <div>
                  <div className="small" style={{ color: "#555", fontWeight: 500 }}>{task.title}</div>
                  <div className="small text-muted">{task.scope || "General"}</div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  style={{ width: "150px" }}
                  value={task.status}
                  onChange={(e) => setTaskStatus(task._id, e.target.value)}
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="complete">Complete</option>
                </select>
                {done && (
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeTask(task._id)} title="Remove completed task">
                    <FaTrashAlt />
                  </button>
                )}
              </div>
            </div>
            {(task.children || []).length > 0 && <div className="ms-3 mt-2">{renderTasks(task.children)}</div>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0"><FaListUl className="me-2" />Task Management</h5>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-lg-4">
              <label className="form-label small fw-semibold">Select Program</label>
              <select
                className="form-select"
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
            </div>

            <div className="col-lg-4">
              <label className="form-label small fw-semibold"><FaFolder className="me-1" />Select Folder</label>
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
            </div>

            <div className="col-lg-4">
              <label className="form-label small fw-semibold">Compliance Progress</label>
              <div className="d-flex justify-content-between align-items-center">
                <div className="small text-muted">
                  {currentFolder
                    ? currentFolder.name
                    : currentProgram
                      ? `${programLabel(currentProgram)} selected`
                      : "No folder selected"}
                </div>
                <div style={{ fontWeight: 600, color: "#555" }}>{Math.round(taskProgress)}%</div>
              </div>
              <div className="progress mt-2" style={{ height: "10px", background: "#d9dce0" }}>
                <div className="progress-bar" style={{ width: `${Math.max(0, Math.min(100, taskProgress))}%`, background: "#45be57" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {!!currentFolderId && (
        <div className="row g-3">
          <div className="col-xl-7">
            <div className="card shadow-sm">
              <div className="card-header bg-light fw-semibold">Create Task</div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Task</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Collect PRC License"
                      value={taskDraft.title}
                      onChange={(e) => setTaskDraft((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Where?</label>
                    <input
                      className="form-control"
                      placeholder={currentFolder?.name || "Folder scope"}
                      value={taskDraft.scope}
                      onChange={(e) => setTaskDraft((prev) => ({ ...prev, scope: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Comments</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Type notes for assigned users"
                      value={taskDraft.comments}
                      onChange={(e) => setTaskDraft((prev) => ({ ...prev, comments: e.target.value }))}
                    />
                  </div>

                </div>

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-danger btn-sm" onClick={submitTask} disabled={isSubmitting || !taskDraft.title.trim()}>
                    <FaPlus className="me-1" />
                    {isSubmitting ? "Creating..." : "Create Task"}
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setTaskDraft({ title: "", scope: "", comments: "" })}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-5">
            <div className="card shadow-sm mb-3">
              <div className="card-header bg-light fw-semibold"><FaUsers className="me-2" />Folder Assignments</div>
              <div className="card-body">
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label small mb-1">Uploaders</label>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      type="button"
                      onClick={() => openAssignModal("uploaders", "Assign Uploaders")}
                    >
                      Open Assign Modal
                    </button>
                  </div>
                  <div className="small text-muted">Listed users: {poolUsersByScope.uploaders.length}</div>
                  {!poolUsersByScope.uploaders.length && (
                    <div className="small text-muted mt-1">
                      No listed uploaders available. Configure role assignments in COPC Workflow first.
                    </div>
                  )}
                  {renderAssigneeBadges(assignments.uploaders || [], "uploaders")}
                </div>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <span className="fw-semibold"><FaCheckCircle className="me-2" />Tasks</span>
                <div className="input-group input-group-sm" style={{ width: "220px" }}>
                  <select className="form-select" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                    <option value="copc_bsit">COPC BSIT</option>
                  </select>
                  <button className="btn btn-outline-primary" onClick={addSuggestedTasks}>Suggest</button>
                </div>
              </div>
              <div className="card-body">
                {renderTasks(folderTasks)}
              </div>
            </div>
          </div>
        </div>
      )}

      {assignModal.open && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,0.2)" }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "460px" }}>
            <div className="modal-content" style={{ borderRadius: "8px" }}>
              <div className="modal-header py-2 px-3">
                <div className="small fw-semibold">{assignModal.title}</div>
                <button type="button" className="btn-close" onClick={closeAssignModal} />
              </div>
              <div className="modal-body p-2">
                <input
                  className="form-control form-control-sm mb-2"
                  placeholder="Search listed users"
                  value={assignModal.search}
                  onChange={(e) => setAssignModal((prev) => ({ ...prev, search: e.target.value }))}
                />
                <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                  {modalUsers.map((u) => {
                    const id = String(u._id);
                    const selected = assignModal.selectedIds.includes(id);
                    return (
                      <div key={id} className="d-flex align-items-center justify-content-between px-1 py-1 border-bottom">
                        <div className="small">
                          <div>{u.name || u.email}</div>
                          <div className="text-muted" style={{ fontSize: "11px" }}>{roleLabel(u.role)}</div>
                        </div>
                        <button
                          className={`btn btn-sm ${selected ? "btn-success" : "btn-outline-primary"}`}
                          type="button"
                          onClick={() => toggleModalUser(id)}
                        >
                          {selected ? "Unassigned" : "Assign"}
                        </button>
                      </div>
                    );
                  })}
                  {!modalUsers.length && (
                    <div className="small text-muted px-1 py-2">No listed users found for this role.</div>
                  )}
                </div>
              </div>
              <div className="modal-footer py-2 px-3">
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={closeAssignModal}>
                  Cancel
                </button>
                <button className="btn btn-sm btn-primary" type="button" onClick={applyAssignModal}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
