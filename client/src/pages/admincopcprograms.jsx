import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaArchive, FaEdit, FaEye, FaLock, FaLockOpen, FaRedoAlt, FaTrash } from "react-icons/fa";
import { BACKEND_URL } from "../config";

function normalizeRole(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "admin") return "superadmin";
  if (raw === "faculty") return "user";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  if (raw === "reviewer") return "evaluator";
  return raw;
}

const stageLabel = (stage) => {
  const map = {
    initialized: "Initialized",
    collecting_documents: "Collecting Documents",
    department_review: "Department Review",
    qa_verification: "QA Verification",
    internal_evaluation: "Internal Evaluation",
    revision: "Revision",
    package_compiled: "Package Compiled",
    copc_ready: "COPC Ready",
    submitted: "Submitted",
    archived: "Archived",
  };
  return map[String(stage || "")] || stage || "N/A";
};

const stageBadgeClass = (stage) => {
  const value = String(stage || "");
  if (value === "copc_ready") return "text-bg-success";
  if (value === "archived") return "text-bg-secondary";
  if (value === "revision") return "text-bg-danger";
  if (value === "submitted") return "text-bg-primary";
  if (value === "package_compiled") return "text-bg-info";
  return "text-bg-light border";
};

export default function AdminCopcProgramsPage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "superadmin";
  const normalizedRole = useMemo(() => normalizeRole(role), [role]);

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyMap, setBusyMap] = useState({});
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [lockFilter, setLockFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const loadPrograms = async () => {
    if (!userId) {
      setPrograms([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, {
        params: { userId, role },
      });
      setPrograms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load COPC programs.");
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageOptions = useMemo(
    () =>
      Array.from(
        new Set((programs || []).map((item) => String(item.workflowStage || "initialized")).filter(Boolean))
      ),
    [programs]
  );

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (programs || [])
            .map((item) => (item.year === null || item.year === undefined ? "" : String(item.year)))
            .filter(Boolean)
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [programs]
  );

  const filteredPrograms = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return (programs || []).filter((item) => {
      const code = String(item.programCode || "").toLowerCase();
      const name = String(item.programName || "").toLowerCase();
      const description = String(item.description || item.departmentName || "").toLowerCase();
      const year = String(item.year || "").toLowerCase();
      const status = String(item.workflowStatus || "").toLowerCase();
      const stage = String(item.workflowStage || "initialized");

      const matchesSearch = !q || code.includes(q) || name.includes(q) || description.includes(q) || year.includes(q) || status.includes(q);
      const matchesStage = stageFilter === "all" || stage === stageFilter;
      const matchesLock = lockFilter === "all" || (lockFilter === "locked" ? !!item.isLocked : !item.isLocked);
      const matchesYear = yearFilter === "all" || year === yearFilter;

      return matchesSearch && matchesStage && matchesLock && matchesYear;
    });
  }, [programs, search, stageFilter, lockFilter, yearFilter]);

  const stats = useMemo(() => {
    const list = programs || [];
    return {
      total: list.length,
      active: list.filter((p) => String(p.workflowStage || "") !== "archived").length,
      archived: list.filter((p) => String(p.workflowStage || "") === "archived").length,
      locked: list.filter((p) => !!p.isLocked).length,
    };
  }, [programs]);

  const setBusy = (programId, action, value) => {
    setBusyMap((prev) => ({
      ...prev,
      [String(programId)]: value ? String(action || "busy") : "",
    }));
  };

  const handleArchive = async (program) => {
    const programId = String(program?._id || "");
    if (!programId) return;
    const label = `${program.programCode || program.name} (${program.year || "N/A"})`;
    if (!window.confirm(`Archive ${label}?`)) return;

    try {
      setBusy(programId, "archive", true);
      await axios.post(`${BACKEND_URL}/copc/programs/${programId}/actions`, {
        userId,
        role,
        action: "archive",
      });
      await loadPrograms();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to archive COPC program.");
    } finally {
      setBusy(programId, "archive", false);
    }
  };

  const handleToggleLock = async (program) => {
    const programId = String(program?._id || "");
    if (!programId) return;
    const action = program?.isLocked ? "unlock" : "lock";
    const label = `${program.programCode || program.name} (${program.year || "N/A"})`;
    const promptLabel = action === "lock" ? "Lock" : "Unlock";
    if (!window.confirm(`${promptLabel} ${label}?`)) return;

    try {
      setBusy(programId, action, true);
      await axios.post(`${BACKEND_URL}/copc/programs/${programId}/actions`, {
        userId,
        role,
        action,
      });
      await loadPrograms();
    } catch (err) {
      alert(err?.response?.data?.error || `Failed to ${action} COPC program.`);
    } finally {
      setBusy(programId, action, false);
    }
  };

  const handleEditProgram = async (program) => {
    const programId = String(program?._id || "");
    if (!programId) return;

    const currentCode = String(program?.programCode || program?.name || "").trim();
    const currentName = String(program?.programName || "").trim();
    const currentDescription = String(program?.description || program?.departmentName || "").trim();

    const nextCodeRaw = window.prompt("Program code", currentCode);
    if (nextCodeRaw === null) return;
    const nextNameRaw = window.prompt("Program name", currentName);
    if (nextNameRaw === null) return;
    const nextDescriptionRaw = window.prompt("Program description", currentDescription);
    if (nextDescriptionRaw === null) return;

    const nextCode = String(nextCodeRaw || "").trim().toUpperCase();
    const nextName = String(nextNameRaw || "").trim();
    const nextDescription = String(nextDescriptionRaw || "").trim();

    if (!nextCode || !nextName) {
      alert("Program code and program name are required.");
      return;
    }

    try {
      setBusy(programId, "update", true);
      await axios.patch(`${BACKEND_URL}/copc/programs/${programId}`, {
        userId,
        role,
        programCode: nextCode,
        programName: nextName,
        description: nextDescription,
      });
      await loadPrograms();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update COPC program details.");
    } finally {
      setBusy(programId, "update", false);
    }
  };

  const handleDelete = async (program) => {
    const programId = String(program?._id || "");
    if (!programId) return;
    const label = `${program.programCode || program.name} (${program.year || "N/A"})`;
    if (!window.confirm(`Delete ${label}? This moves the entire COPC workspace to trash.`)) return;

    try {
      setBusy(programId, "delete", true);
      await axios.delete(`${BACKEND_URL}/copc/programs/${programId}`, {
        params: { userId, role },
      });
      await loadPrograms();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to delete COPC program.");
    } finally {
      setBusy(programId, "delete", false);
    }
  };

  if (normalizedRole !== "superadmin") {
    return <div className="alert alert-danger">Only super admin can manage COPC programs.</div>;
  }

  return (
    <div className="container-fluid py-2">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">COPC Program Management</h4>
          <div className="small text-muted">Lock/unlock, rename, update descriptions, archive, or delete COPC programs from one admin page.</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate("/admin/copc-archived")}
          >
            <FaArchive className="me-1" />
            Archived Programs
          </button>
          <button className="btn btn-outline-primary" onClick={loadPrograms} disabled={loading}>
            <FaRedoAlt className="me-1" />
            Refresh
          </button>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Total Programs</div>
              <div className="fw-bold fs-4">{stats.total}</div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Active</div>
              <div className="fw-bold fs-4">{stats.active}</div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <button
            type="button"
            className="card shadow-sm h-100 w-100 text-start"
            onClick={() => navigate("/admin/copc-archived")}
            title="Open archived COPC programs"
          >
            <div className="card-body py-3">
              <div className="small text-muted d-flex align-items-center gap-1">
                <FaArchive />
                Archived
              </div>
              <div className="fw-bold fs-4">{stats.archived}</div>
            </div>
          </button>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Locked</div>
              <div className="fw-bold fs-4">{stats.locked}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-lg-4 col-md-6">
              <input
                className="form-control"
                placeholder="Search program code, name, description, year"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-lg-3 col-md-6">
              <select className="form-select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option value="all">All Stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabel(stage)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-md-6">
              <select className="form-select" value={lockFilter} onChange={(e) => setLockFilter(e.target.value)}>
                <option value="all">All Lock States</option>
                <option value="locked">Locked Only</option>
                <option value="unlocked">Unlocked Only</option>
              </select>
            </div>
            <div className="col-lg-2 col-md-6">
              <select className="form-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="all">All Years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-1 col-md-6 d-grid">
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  setSearch("");
                  setStageFilter("all");
                  setLockFilter("all");
                  setYearFilter("all");
                }}
                title="Reset filters"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-light fw-semibold">
          Program List ({filteredPrograms.length})
        </div>
        <div className="card-body p-0">
          {loading && <div className="p-3 small text-muted">Loading programs...</div>}
          {!loading && error && <div className="p-3 text-danger">{error}</div>}
          {!loading && !error && filteredPrograms.length === 0 && (
            <div className="p-3 text-muted">No COPC programs match the selected filters.</div>
          )}
          {!loading && !error && filteredPrograms.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Program</th>
                    <th>Description</th>
                    <th>Year</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Lock</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.map((program) => {
                    const id = String(program._id);
                    const busy = String(busyMap[id] || "");
                    const isArchived = String(program.workflowStage || "") === "archived";
                    return (
                      <tr key={id}>
                        <td>
                          <div className="fw-semibold">{program.programCode || program.name}</div>
                          <div className="small text-muted">{program.programName || "Untitled Program"}</div>
                        </td>
                        <td>{program.description || program.departmentName || "N/A"}</td>
                        <td>{program.year || "N/A"}</td>
                        <td>
                          <span className={`badge ${stageBadgeClass(program.workflowStage)}`}>
                            {stageLabel(program.workflowStage)}
                          </span>
                        </td>
                        <td>{program.workflowStatus || "In Progress"}</td>
                        <td>
                          <span
                            className={`badge d-inline-flex align-items-center gap-1 ${program.isLocked ? "text-bg-danger" : "text-bg-success"}`}
                          >
                            {program.isLocked ? <FaLock /> : <FaLockOpen />}
                            {program.isLocked ? "Locked" : "Unlocked"}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-2 justify-content-end flex-wrap">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                navigate(
                                  `/admin/copc-dashboard?tab=workflow&programId=${encodeURIComponent(id)}`
                                )
                              }
                            >
                              <FaEye className="me-1" />
                              Open
                            </button>
                            <button
                              className="btn btn-sm btn-outline-warning"
                              disabled={busy.length > 0}
                              onClick={() => handleEditProgram(program)}
                            >
                              <FaEdit className="me-1" />
                              {busy === "update" ? "Saving..." : "Edit"}
                            </button>
                            <button
                              className={`btn btn-sm ${program.isLocked ? "btn-success" : "btn-danger"}`}
                              disabled={busy.length > 0}
                              onClick={() => handleToggleLock(program)}
                            >
                              {program.isLocked ? <FaLockOpen className="me-1" /> : <FaLock className="me-1" />}
                              {busy === "lock"
                                ? "Locking..."
                                : busy === "unlock"
                                  ? "Unlocking..."
                                  : program.isLocked
                                    ? "Unlock"
                                    : "Lock"}
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              disabled={busy.length > 0 || isArchived}
                              onClick={() => handleArchive(program)}
                            >
                              <FaArchive className="me-1" />
                              {isArchived ? "Archived" : busy === "archive" ? "Archiving..." : "Archive"}
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={busy.length > 0}
                              onClick={() => handleDelete(program)}
                            >
                              <FaTrash className="me-1" />
                              {busy === "delete" ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
