import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaCheckCircle, FaCog, FaDownload, FaFolderOpen, FaTimes } from "react-icons/fa";
import { BACKEND_URL } from "../config";
import { useNavigate, useSearchParams } from "react-router-dom";

const DEPARTMENT_CODES = ["COED", "COT", "COHTM"];

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const toDisplayFolderLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function CopcWorkflowPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedProgramId = String(searchParams.get("programId") || "");
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "faculty";
  const normalizedRole = useMemo(() => {
    const raw = String(role || "").toLowerCase();
    if (raw === "admin") return "superadmin";
    if (raw === "user") return "faculty";
    if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
    if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
    if (raw === "reviewer") return "evaluator";
    return raw;
  }, [role]);

  const [programs, setPrograms] = useState([]);
  const [users, setUsers] = useState([]);
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [workflowCards, setWorkflowCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initDraft, setInitDraft] = useState({
    programCode: "",
    programName: "",
    description: "",
    year: new Date().getFullYear(),
    deptChairIds: [],
    qaAdminIds: [],
    evaluatorIds: [],
    uploaderIds: [],
  });
  const [observationText, setObservationText] = useState("");
  const [programAssignments, setProgramAssignments] = useState({
    uploaders: [],
    uploaderGroups: [],
    programChairs: [],
    qaOfficers: [],
    evaluators: [],
  });
  const [assignModal, setAssignModal] = useState({
    open: false,
    title: "Assign to:",
    selectedIds: [],
    candidateIds: [],
    candidateType: "user",
    search: "",
    onSave: null,
  });

  const isSuperAdmin = normalizedRole === "superadmin";
  const canReviewFacultySubmissions = isSuperAdmin || normalizedRole === "dept_chair";
  const canReviewComplianceSubmissions = isSuperAdmin || normalizedRole === "qa_admin";
  const canOpenEvaluationStage = isSuperAdmin || normalizedRole === "evaluator";
  const canOpenUploadWorkspace = !isSuperAdmin && normalizedRole !== "evaluator";
  const canOpenSummaryFolders = normalizedRole !== "evaluator";

  const buildWorkflowCards = (workflowData, folderRows = [], programId) => {
    const summaryRows = Array.isArray(workflowData?.summary) ? workflowData.summary : [];
    const summaryById = new Map();
    const summaryByLabel = new Map();

    summaryRows.forEach((row) => {
      const rowId = String(row?.folderId || "");
      const rowLabel = String(row?.label || "");
      const rowPercent = Number(row?.percent || 0);
      if (rowId) summaryById.set(rowId, rowPercent);
      if (rowLabel) summaryByLabel.set(rowLabel, rowPercent);
    });

    const topFolders = (Array.isArray(folderRows) ? folderRows : [])
      .filter(
        (folder) =>
          !folder?.isProgramRoot &&
          String(folder?.parentFolder || "") === String(programId || "")
      )
      .sort((a, b) => String(b?.name || "").localeCompare(String(a?.name || "")));

    if (!topFolders.length) {
      return summaryRows.map((row) => ({
        folderId: String(row?.folderId || ""),
        label: String(row?.label || "Untitled Folder"),
        percent: Number(row?.percent || 0),
      }));
    }

    return topFolders.map((folder) => {
      const folderId = String(folder?._id || "");
      const folderName = String(folder?.name || "Untitled Folder");
      const percent = summaryById.has(folderId)
        ? Number(summaryById.get(folderId) || 0)
        : Number(summaryByLabel.get(folderName) || 0);
      return {
        folderId,
        label: folderName,
        percent,
      };
    });
  };

  const loadPrograms = async () => {
    const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, { params: { userId, role } });
    const list = Array.isArray(data) ? data : [];
    setPrograms(list);
    const requestedExists = requestedProgramId && list.some((item) => String(item._id) === requestedProgramId);
    const selectedExists = selectedProgramId && list.some((item) => String(item._id) === String(selectedProgramId));
    if (requestedExists) {
      setSelectedProgramId(requestedProgramId);
      return;
    }
    if (!selectedExists) {
      setSelectedProgramId(list.length ? String(list[0]._id) : "");
    }
  };

  const loadUsers = async () => {
    if (!isSuperAdmin) return;
    const { data } = await axios.get(`${BACKEND_URL}/users`, { params: { userId, role } });
    setUsers(Array.isArray(data) ? data : []);
  };

  const loadDepartmentGroups = async () => {
    if (!isSuperAdmin) return;
    let rows = [];
    try {
      const { data } = await axios.get(`${BACKEND_URL}/department-groups`, { params: { userId, role } });
      rows = Array.isArray(data) ? data : [];
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 404) throw err;
      const fallback = await axios.get(`${BACKEND_URL}/groups`, { params: { userId, role } });
      const groupRows = Array.isArray(fallback?.data) ? fallback.data : [];
      rows = groupRows.map((group) => ({
        _id: group?._id,
        name: String(group?.name || "").toUpperCase(),
        code: String(group?.name || "").toUpperCase(),
        memberCount: Array.isArray(group?.members) ? group.members.length : 0,
      }));
    }
    setDepartmentGroups(
      rows
        .filter((group) => DEPARTMENT_CODES.includes(String(group?.code || group?.name || "").toUpperCase()))
        .map((group) => ({
          ...group,
          code: String(group?.code || group?.name || "").toUpperCase(),
          name: String(group?.name || group?.code || "").toUpperCase(),
        }))
    );
  };

  const loadWorkflow = async (programId, options = {}) => {
    const silent = !!options.silent;
    if (!programId) return;
    if (!silent) setLoading(true);
    try {
      const [workflowRes, foldersRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/copc/programs/${programId}/workflow`, {
          params: { userId, role },
        }),
        axios.get(`${BACKEND_URL}/copc/programs/${programId}/folders`, {
          params: { userId, role },
        }),
      ]);

      const data = workflowRes?.data || null;
      const folderRows = Array.isArray(foldersRes?.data?.folders) ? foldersRes.data.folders : [];
      setWorkflow(data);
      setWorkflowCards(buildWorkflowCards(data, folderRows, programId));

      if (data?.program?.assignments) {
        setProgramAssignments({
          uploaders: (data.program.assignments.uploaders || []).map((v) => String(v?._id || v)),
          uploaderGroups: (data.program.assignments.uploaderGroups || []).map((v) => String(v?._id || v)),
          programChairs: (data.program.assignments.programChairs || []).map((v) => String(v?._id || v)),
          qaOfficers: (data.program.assignments.qaOfficers || []).map((v) => String(v?._id || v)),
          evaluators: (data.program.assignments.evaluators || []).map((v) => String(v?._id || v)),
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms().catch(() => setPrograms([]));
    loadUsers().catch(() => setUsers([]));
    loadDepartmentGroups().catch(() => setDepartmentGroups([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!requestedProgramId) return;
    const exists = programs.some((item) => String(item._id) === requestedProgramId);
    if (exists) setSelectedProgramId(requestedProgramId);
  }, [requestedProgramId, programs]);

  useEffect(() => {
    if (!selectedProgramId) return;
    loadWorkflow(selectedProgramId).catch(() => {
      setWorkflow(null);
      setWorkflowCards([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  useEffect(() => {
    if (!selectedProgramId) return undefined;

    const refresh = () => {
      loadWorkflow(selectedProgramId, { silent: true }).catch(() => {});
    };

    const timer = setInterval(refresh, 10000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  const roleUsers = (targetRole) =>
    users.filter((u) => {
      const r = String(u.role || "").toLowerCase();
      if (targetRole === "dept_chair") return ["dept_chair", "program_chair", "department_chair"].includes(r);
      if (targetRole === "qa_admin") return ["qa_admin", "qa_officer", "quality_assurance_admin"].includes(r);
      if (targetRole === "evaluator") return ["evaluator", "reviewer"].includes(r);
      if (targetRole === "uploader") return ["faculty", "user", "dept_chair", "program_chair", "department_chair", "qa_admin", "qa_officer", "quality_assurance_admin", "superadmin", "admin"].includes(r);
      return true;
    });

  const roleLabel = (value) => {
    const r = String(value || "").toLowerCase();
    if (["dept_chair", "program_chair", "department_chair"].includes(r)) return "Dept Chair";
    if (["qa_admin", "qa_officer", "quality_assurance_admin"].includes(r)) return "QA Admin";
    if (r === "faculty" || r === "user") return "Faculty";
    if (r === "evaluator" || r === "reviewer") return "Evaluator";
    if (r === "superadmin" || r === "admin") return "Super Admin";
    return value;
  };

  const openAssignModal = ({ title, candidateIds, selectedIds, candidateType = "user", onSave }) => {
    setAssignModal({
      open: true,
      title: title || "Assign to:",
      selectedIds: selectedIds || [],
      candidateIds: candidateIds || [],
      candidateType,
      search: "",
      onSave,
    });
  };

  const closeAssignModal = () => {
    setAssignModal({
      open: false,
      title: "Assign to:",
      selectedIds: [],
      candidateIds: [],
      candidateType: "user",
      search: "",
      onSave: null,
    });
  };

  const toggleModalSelection = (id) => {
    setAssignModal((prev) => {
      const raw = String(id);
      const exists = prev.selectedIds.includes(raw);
      return {
        ...prev,
        selectedIds: exists ? prev.selectedIds.filter((x) => x !== raw) : [...prev.selectedIds, raw],
      };
    });
  };

  const saveAssignModal = () => {
    if (typeof assignModal.onSave === "function") assignModal.onSave(assignModal.selectedIds);
    closeAssignModal();
  };

  const modalCandidates = useMemo(() => {
    const ids = new Set((assignModal.candidateIds || []).map(String));
    const q = assignModal.search.trim().toLowerCase();
    if (assignModal.candidateType === "group") {
      return departmentGroups
        .filter((group) => ids.has(String(group._id)))
        .filter((group) => {
          if (!q) return true;
          const name = String(group.name || "").toLowerCase();
          const code = String(group.code || "").toLowerCase();
          return name.includes(q) || code.includes(q);
        });
    }
    return users
      .filter((u) => ids.has(String(u._id)))
      .filter((u) => {
        if (!q) return true;
        const name = String(u.name || "").toLowerCase();
        const email = String(u.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
  }, [assignModal.candidateIds, assignModal.candidateType, assignModal.search, departmentGroups, users]);

  const renderAssignmentCount = (ids = [], singular, plural) => {
    const count = new Set((ids || []).map(String).filter(Boolean)).size;
    if (count < 1) return <div className="small text-muted mt-1">No assigned users.</div>;
    return (
      <div className="small text-muted mt-1">
        {count} {count === 1 ? singular : plural} assigned.
      </div>
    );
  };

  const submitInit = async () => {
    await axios.post(`${BACKEND_URL}/copc/programs/init`, {
      userId,
      role,
      ...initDraft,
      year: Number(initDraft.year),
    });
    setInitDraft((prev) => ({ ...prev, programCode: "", programName: "", description: "" }));
    await loadPrograms();
  };

  const runAction = async (action) => {
    if (!selectedProgramId) return;
    try {
      await axios.post(`${BACKEND_URL}/copc/programs/${selectedProgramId}/actions`, {
        userId,
        role,
        action,
      });
      await loadWorkflow(selectedProgramId);
      await loadPrograms();
    } catch (err) {
      const message = err?.response?.data?.error || "Failed to process workflow action";
      alert(message);
    }
  };

  const saveProgramAssignments = async (nextAssignments = programAssignments) => {
    if (!selectedProgramId) return;
    await axios.patch(`${BACKEND_URL}/copc/programs/${selectedProgramId}/assignments`, {
      userId,
      role,
      assignments: nextAssignments,
    });
    await loadWorkflow(selectedProgramId);
    await loadPrograms();
  };

  const addObservation = async () => {
    if (!selectedProgramId || !observationText.trim()) return;
    await axios.post(`${BACKEND_URL}/copc/programs/${selectedProgramId}/observations`, {
      userId,
      role,
      message: observationText.trim(),
    });
    setObservationText("");
    await loadWorkflow(selectedProgramId);
  };

  const downloadPackage = () => {
    if (!selectedProgramId) return;
    const url = `${BACKEND_URL}/copc/programs/${selectedProgramId}/package/download?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
    window.open(url, "_blank");
  };

  const openDashboardTab = (tab, extraParams = {}) => {
    const params = new URLSearchParams({
      tab: String(tab || "workflow"),
    });
    if (selectedProgramId) params.set("programId", String(selectedProgramId));
    Object.entries(extraParams || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      params.set(key, String(value));
    });
    navigate(`/copc-dashboard?${params.toString()}`);
  };

  const openSummaryFolder = (folderId) => {
    const targetFolderId = String(folderId || "");
    if (!selectedProgramId || !targetFolderId) return;
    openDashboardTab("upload", { folderId: targetFolderId });
  };

  return (
    <div className="container-fluid py-2">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="mb-0">COPC Workflow</h4>
        <div className="d-flex gap-2">
          {canOpenUploadWorkspace && (
            <button className="btn btn-outline-success" onClick={() => openDashboardTab("upload")}>
              <FaFolderOpen className="me-1" />
              Go to COPC Upload
            </button>
          )}
          {canReviewFacultySubmissions && (
            <button
              className="btn btn-outline-primary"
              disabled={!selectedProgramId}
              onClick={() => openDashboardTab("department_review")}
            >
              <FaCheckCircle className="me-1" />
              Review Faculty Submissions
            </button>
          )}
          {canReviewComplianceSubmissions && (
            <button
              className="btn btn-outline-warning"
              disabled={!selectedProgramId}
              onClick={() => openDashboardTab("qa_review")}
            >
              <FaCheckCircle className="me-1" />
              QA Compliance Review
            </button>
          )}
          {canOpenEvaluationStage && (
            <button
              className="btn btn-outline-secondary"
              disabled={!selectedProgramId}
              onClick={() => openDashboardTab("evaluation")}
            >
              <FaCheckCircle className="me-1" />
              Evaluation Stage
            </button>
          )}
          <select
            className="form-select"
            style={{ minWidth: "260px", width: "100%", maxWidth: "460px" }}
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
          >
            <option value="">Select Program</option>
            {programs.map((p) => (
              <option key={p._id} value={p._id}>
                {p.programCode || p.name} - {p.programName || p.name} ({p.year || "N/A"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-light fw-semibold">Create COPC</div>
          <div className="card-body">
            <div className="row g-2">
              <div className="col-md-3"><input className="form-control" placeholder="Program Code (BSIT)" value={initDraft.programCode} onChange={(e) => setInitDraft((p) => ({ ...p, programCode: e.target.value }))} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Program Name" value={initDraft.programName} onChange={(e) => setInitDraft((p) => ({ ...p, programName: e.target.value }))} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Description" value={initDraft.description} onChange={(e) => setInitDraft((p) => ({ ...p, description: e.target.value }))} /></div>
              <div className="col-md-2"><input className="form-control" type="number" value={initDraft.year} onChange={(e) => setInitDraft((p) => ({ ...p, year: e.target.value }))} /></div>
              <div className="col-md-1 d-grid"><button className="btn btn-primary" onClick={submitInit}><FaCog /></button></div>
            </div>
            <div className="small text-muted mt-2">Create COPC with its description, then use the Program Role Assignments card below.</div>
          </div>
        </div>
      )}

      {!selectedProgramId && <div className="alert alert-info">Select a COPC program to view workflow status.</div>}

      {selectedProgramId && workflow && (
        <>
          {isSuperAdmin && (
            <div className="card shadow-sm mb-3">
              <div className="card-header bg-light fw-semibold">Program Role Assignments (Persistent)</div>
              <div className="card-body">
                <div className="row g-2">
                  <div className="col-lg-3 col-md-6">
                    <label className="small text-muted">Uploaders</label>
                    <div className="d-flex flex-column gap-2">
                      <button
                        className="btn btn-outline-primary btn-sm w-100"
                        onClick={() =>
                          openAssignModal({
                            title: "Assign Uploaders (Users)",
                            candidateType: "user",
                            candidateIds: roleUsers("uploader").map((u) => String(u._id)),
                            selectedIds: (programAssignments.uploaders || []).map(String),
                            onSave: async (ids) => {
                              const next = { ...programAssignments, uploaders: ids };
                              setProgramAssignments(next);
                              await saveProgramAssignments(next);
                            },
                          })
                        }
                      >
                        Assign Users
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm w-100"
                        onClick={() =>
                          openAssignModal({
                            title: "Assign Uploaders (Department Groups)",
                            candidateType: "group",
                            candidateIds: departmentGroups.map((group) => String(group._id)),
                            selectedIds: (programAssignments.uploaderGroups || []).map(String),
                            onSave: async (ids) => {
                              const next = { ...programAssignments, uploaderGroups: ids };
                              setProgramAssignments(next);
                              await saveProgramAssignments(next);
                            },
                          })
                        }
                      >
                        Assign Department Groups
                      </button>
                    </div>
                    {renderAssignmentCount(programAssignments.uploaders, "uploader", "uploaders")}
                    {renderAssignmentCount(programAssignments.uploaderGroups, "department group", "department groups")}
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <label className="small text-muted">Dept Chairs</label>
                    <button
                      className="btn btn-outline-primary btn-sm w-100"
                      onClick={() =>
                        openAssignModal({
                          title: "Assign Dept Chairs",
                          candidateIds: roleUsers("dept_chair").map((u) => String(u._id)),
                          selectedIds: (programAssignments.programChairs || []).map(String),
                          onSave: async (ids) => {
                            const next = { ...programAssignments, programChairs: ids };
                            setProgramAssignments(next);
                            await saveProgramAssignments(next);
                          },
                        })
                      }
                    >
                      Open Assign Modal
                    </button>
                    {renderAssignmentCount(programAssignments.programChairs, "dept chair", "dept chairs")}
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <label className="small text-muted">QA Admins</label>
                    <button
                      className="btn btn-outline-primary btn-sm w-100"
                      onClick={() =>
                        openAssignModal({
                          title: "Assign QA Admins",
                          candidateIds: roleUsers("qa_admin").map((u) => String(u._id)),
                          selectedIds: (programAssignments.qaOfficers || []).map(String),
                          onSave: async (ids) => {
                            const next = { ...programAssignments, qaOfficers: ids };
                            setProgramAssignments(next);
                            await saveProgramAssignments(next);
                          },
                        })
                      }
                    >
                      Open Assign Modal
                    </button>
                    {renderAssignmentCount(programAssignments.qaOfficers, "QA admin", "QA admins")}
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <label className="small text-muted">Evaluators</label>
                    <button
                      className="btn btn-outline-primary btn-sm w-100"
                      onClick={() =>
                        openAssignModal({
                          title: "Assign Evaluators",
                          candidateIds: roleUsers("evaluator").map((u) => String(u._id)),
                          selectedIds: (programAssignments.evaluators || []).map(String),
                          onSave: async (ids) => {
                            const next = { ...programAssignments, evaluators: ids };
                            setProgramAssignments(next);
                            await saveProgramAssignments(next);
                          },
                        })
                      }
                    >
                      Open Assign Modal
                    </button>
                    {renderAssignmentCount(programAssignments.evaluators, "evaluator", "evaluators")}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <h5 className="mb-1">{workflow.program.code} - {workflow.program.name}</h5>
                  <div className="text-muted small">{workflow.program.description || "No description"} | AY {workflow.program.year || "N/A"}</div>
                </div>
                <div>
                  <span className={`badge ${workflow.program.isLocked ? "bg-danger" : "bg-success"}`}>{workflow.program.status}</span>
                </div>
              </div>
              <div className="mt-3 d-flex flex-wrap gap-2">
                {workflow.steps.map((step) => (
                  <span key={step.key} className={`badge ${step.current ? "text-bg-primary" : step.complete ? "text-bg-success" : "text-bg-light"}`}>
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12">
              <div
                className="card h-100 shadow-sm border-primary border-2"
                style={{ background: "rgba(13,110,253,0.08)" }}
              >
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <div className="small text-primary fw-semibold">Overall Compliance</div>
                      <div className="fw-bold fs-4 text-primary">{Math.round(clampPercent(workflow.overallCompliance))}%</div>
                    </div>
                  </div>
                  <div className="progress mt-3" style={{ height: "10px" }}>
                    <div
                      className="progress-bar bg-primary"
                      role="progressbar"
                      style={{ width: `${clampPercent(workflow.overallCompliance)}%` }}
                      aria-valuenow={clampPercent(workflow.overallCompliance)}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                </div>
              </div>
            </div>
            {workflowCards.map((row) => {
              const rawLabel = String(row?.label || "Untitled Folder");
              const displayLabel = toDisplayFolderLabel(rawLabel) || "Untitled Folder";
              const folderPercent = clampPercent(row?.percent);
              const folderId = String(row?.folderId || "");
              const canOpenFolder = canOpenSummaryFolders && !!selectedProgramId && !!folderId;
              return (
                <div key={folderId || rawLabel} className="col-xl-3 col-md-6">
                  <div className={`card h-100 shadow-sm ${canOpenFolder ? "border-primary-subtle" : ""}`}>
                    <button
                      type="button"
                      className="btn text-start w-100 h-100 p-0 border-0"
                      onClick={() => canOpenFolder && openSummaryFolder(folderId)}
                      disabled={!canOpenFolder}
                      title={canOpenFolder ? `Open folder: ${displayLabel}` : "Folder link unavailable"}
                      style={{ cursor: canOpenFolder ? "pointer" : "default" }}
                    >
                      <div className="card-body py-3">
                        <div className="small text-muted">{displayLabel}</div>
                        <div className="fw-bold fs-5">{Math.round(folderPercent)}%</div>
                        <div className="progress mt-2" style={{ height: "8px" }}>
                          <div
                            className="progress-bar"
                            role="progressbar"
                            style={{ width: `${folderPercent}%` }}
                            aria-valuenow={folderPercent}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          />
                        </div>
                        <div className={`small mt-2 ${canOpenFolder ? "text-primary" : "text-muted"}`}>
                          {canOpenFolder ? "Open folder" : "Folder link unavailable"}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row g-3 mb-3">
            <div className="col-xl-3 col-md-6"><div className="card shadow-sm h-100"><div className="card-body"><div className="small text-muted">Submitted Docs</div><div className="fw-bold fs-4">{workflow.counts.submitted}</div></div></div></div>
            <div className="col-xl-3 col-md-6"><div className="card shadow-sm h-100"><div className="card-body"><div className="small text-muted">Pending Dept Review</div><div className="fw-bold fs-4">{workflow.counts.pendingProgramChair}</div></div></div></div>
            <div className="col-xl-3 col-md-6"><div className="card shadow-sm h-100"><div className="card-body"><div className="small text-muted">Pending QA</div><div className="fw-bold fs-4">{workflow.counts.pendingQa}</div></div></div></div>
            <div className="col-xl-3 col-md-6"><div className="card shadow-sm h-100"><div className="card-body"><div className="small text-muted">Rejected / For Revision</div><div className="fw-bold fs-4 text-danger">{workflow.counts.rejected}</div></div></div></div>
          </div>

          {isSuperAdmin && workflow.finalApprovalChecklist && (
            <div className="card shadow-sm mb-3">
              <div className="card-header bg-light fw-semibold">Final Approval Stage (Super Admin)</div>
              <div className="card-body">
                <div className="row g-2">
                  <div className="col-md-6 small">
                    Final document verification:{" "}
                    <span className={`badge ${workflow.finalApprovalChecklist.finalDocumentVerification ? "bg-success" : "bg-secondary"}`}>
                      {workflow.finalApprovalChecklist.finalDocumentVerification ? "Complete" : "Pending"}
                    </span>
                  </div>
                  <div className="col-md-6 small">
                    System audit review:{" "}
                    <span className={`badge ${workflow.finalApprovalChecklist.systemAuditReview ? "bg-success" : "bg-secondary"}`}>
                      {workflow.finalApprovalChecklist.systemAuditReview ? "Complete" : "Pending"}
                    </span>
                  </div>
                  <div className="col-md-6 small">
                    Generate final COPC submission file:{" "}
                    <span className={`badge ${workflow.finalApprovalChecklist.generateFinalCopcSubmissionFile ? "bg-success" : "bg-secondary"}`}>
                      {workflow.finalApprovalChecklist.generateFinalCopcSubmissionFile ? "Ready" : "Pending"}
                    </span>
                  </div>
                  <div className="col-md-6 small">
                    Lock approved documents:{" "}
                    <span className={`badge ${workflow.program.isLocked ? "bg-success" : "bg-secondary"}`}>
                      {workflow.program.isLocked ? "Locked" : "Not Locked"}
                    </span>
                  </div>
                </div>
                <div className="d-flex gap-2 flex-wrap mt-3">
                  <span className={`badge ${workflow.program.stage === "copc_ready" ? "bg-success" : "bg-warning text-dark"}`}>
                    Status: {workflow.program.stage === "copc_ready" ? "COPC Ready" : workflow.program.status}
                  </span>
                  {workflow.program.isLocked && (
                    <>
                      <span className="badge bg-dark">Document Locked</span>
                      <span className="badge bg-dark">Editing Disabled</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card shadow-sm">
            <div className="card-header bg-light fw-semibold">Workflow Actions</div>
            <div className="card-body">
              {loading && <div className="small text-muted mb-2">Refreshing...</div>}
              <div className="d-flex flex-wrap gap-2 align-items-start">
                <button className="btn btn-outline-primary" onClick={downloadPackage}><FaFolderOpen className="me-1" />Open Package</button>
                <button className="btn btn-outline-dark" onClick={downloadPackage}><FaDownload className="me-1" />Download ZIP</button>
                {workflow.actions.canCompile && (
                  <button className="btn btn-primary" onClick={() => runAction("compile_package")} disabled={workflow.program.isLocked}>
                    <FaCog className="me-1" />Compile COPC Package
                  </button>
                )}
                {workflow.actions.canFinalApprove && (
                  <button className="btn btn-success" onClick={() => runAction("final_approval")} disabled={workflow.program.isLocked}>
                    <FaCheckCircle className="me-1" />Finalize COPC Ready (Lock + Generate)
                  </button>
                )}
                {workflow.actions.canArchive && (
                  <button className="btn btn-secondary" onClick={() => runAction("archive")}>Archive Documents</button>
                )}
              </div>
              {["qa_admin", "superadmin"].includes(normalizedRole) && (
                <div className="mt-3">
                  <label className="small text-muted">Internal Evaluation Observation</label>
                  <div className="d-flex gap-2 mt-1">
                    <input
                      className="form-control"
                      placeholder="e.g. Missing PRC License for one faculty member"
                      value={observationText}
                      onChange={(e) => setObservationText(e.target.value)}
                    />
                    <button className="btn btn-outline-danger" onClick={addObservation} disabled={!observationText.trim()}>
                      Flag
                    </button>
                  </div>
                </div>
              )}
              {Array.isArray(workflow.observations) && workflow.observations.length > 0 && (
                <div className="mt-3">
                  <div className="small fw-semibold mb-1">Observations</div>
                  <ul className="list-group">
                    {workflow.observations.slice().reverse().slice(0, 6).map((item, idx) => (
                      <li key={`${item.createdAt || idx}`} className="list-group-item py-2">
                        <div className="small">{item.message}</div>
                        <div className="text-muted" style={{ fontSize: "12px" }}>{item.role || "reviewer"} | {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
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
                  placeholder={assignModal.candidateType === "group" ? "Search department group" : "Enter name to find member"}
                  value={assignModal.search}
                  onChange={(e) => setAssignModal((prev) => ({ ...prev, search: e.target.value }))}
                />
                <div style={{ maxHeight: "230px", overflowY: "auto" }}>
                  {modalCandidates.map((item) => {
                    const selected = assignModal.selectedIds.includes(String(item._id));
                    const initials = String(
                      assignModal.candidateType === "group"
                        ? item.code || item.name || "G"
                        : item.name || item.email || "U"
                    )
                      .slice(0, 1)
                      .toUpperCase();
                    const primaryText =
                      assignModal.candidateType === "group" ? item.name || item.code : item.name || item.email;
                    const secondaryText =
                      assignModal.candidateType === "group"
                        ? `${Number(item.memberCount || 0)} member${Number(item.memberCount || 0) === 1 ? "" : "s"}`
                        : roleLabel(item.role);
                    return (
                      <div key={item._id} className="d-flex align-items-center justify-content-between px-1 py-1 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center text-white small"
                            style={{
                              width: "28px",
                              height: "28px",
                              background: assignModal.candidateType === "group" ? "#0d6efd" : "#6c757d",
                            }}
                          >
                            {initials}
                          </div>
                          <div className="small">
                            <div>{primaryText}</div>
                            <div className="text-muted" style={{ fontSize: "11px" }}>{secondaryText}</div>
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${selected ? "btn-success" : "btn-outline-primary"}`}
                          onClick={() => toggleModalSelection(item._id)}
                        >
                          {selected ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                  {modalCandidates.length === 0 && (
                    <div className="small text-muted px-1 py-2">No matching entries found.</div>
                  )}
                </div>
              </div>
              <div className="modal-footer py-2 px-3">
                <button className="btn btn-sm btn-outline-secondary" onClick={closeAssignModal}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={saveAssignModal}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
