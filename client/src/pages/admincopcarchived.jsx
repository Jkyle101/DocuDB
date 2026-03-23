import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaArchive,
  FaEye,
  FaLock,
  FaLockOpen,
  FaRedoAlt,
  FaUndoAlt,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";

function normalizeRole(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "admin") return "superadmin";
  if (raw === "user") return "faculty";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  if (raw === "reviewer") return "evaluator";
  return raw;
}

export default function AdminCopcArchivedPage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "superadmin";
  const normalizedRole = useMemo(() => normalizeRole(role), [role]);

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyMap, setBusyMap] = useState({});
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [lockFilter, setLockFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const setBusy = (programId, action, value) => {
    setBusyMap((prev) => ({
      ...prev,
      [String(programId)]: value ? String(action || "busy") : "",
    }));
  };

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
      const list = Array.isArray(data) ? data : [];
      setPrograms(list.filter((item) => String(item.workflowStage || "") === "archived"));
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load archived COPC programs.");
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const matchesSearch =
        !q ||
        code.includes(q) ||
        name.includes(q) ||
        description.includes(q) ||
        year.includes(q) ||
        status.includes(q);
      const matchesLock = lockFilter === "all" || (lockFilter === "locked" ? !!item.isLocked : !item.isLocked);
      const matchesYear = yearFilter === "all" || year === yearFilter;
      return matchesSearch && matchesLock && matchesYear;
    });
  }, [programs, search, lockFilter, yearFilter]);

  const stats = useMemo(() => {
    const list = programs || [];
    return {
      total: list.length,
      locked: list.filter((p) => !!p.isLocked).length,
      unlocked: list.filter((p) => !p.isLocked).length,
    };
  }, [programs]);

  const handleUnarchive = async (program) => {
    const programId = String(program?._id || "");
    if (!programId) return;
    const label = `${program.programCode || program.name} (${program.year || "N/A"})`;
    if (!window.confirm(`Unarchive ${label}?`)) return;

    try {
      setBusy(programId, "unarchive", true);
      await axios.post(`${BACKEND_URL}/copc/programs/${programId}/actions`, {
        userId,
        role,
        action: "unarchive",
      });
      await loadPrograms();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to unarchive COPC program.");
    } finally {
      setBusy(programId, "unarchive", false);
    }
  };

  if (normalizedRole !== "superadmin") {
    return <div className="alert alert-danger">Only super admin can view archived COPC programs.</div>;
  }

  return (
    <div className="container-fluid py-2">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Archived COPC Programs</h4>
          <div className="small text-muted">Review archived programs and unarchive them when needed.</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate("/admin/copc-dashboard?tab=programs")}
          >
            Program Management
          </button>
          <button className="btn btn-outline-primary" onClick={loadPrograms} disabled={loading}>
            <FaRedoAlt className="me-1" />
            Refresh
          </button>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Archived Programs</div>
              <div className="fw-bold fs-4">{stats.total}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Locked</div>
              <div className="fw-bold fs-4 text-danger">{stats.locked}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Unlocked</div>
              <div className="fw-bold fs-4 text-success">{stats.unlocked}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-lg-6 col-md-6">
              <input
                className="form-control"
                placeholder="Search archived program code, name, description, year"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-lg-3 col-md-6">
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
          Archived Program List ({filteredPrograms.length})
        </div>
        <div className="card-body p-0">
          {loading && <div className="p-3 small text-muted">Loading archived programs...</div>}
          {!loading && error && <div className="p-3 text-danger">{error}</div>}
          {!loading && !error && filteredPrograms.length === 0 && (
            <div className="p-3 text-muted">No archived COPC programs match the selected filters.</div>
          )}
          {!loading && !error && filteredPrograms.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Program</th>
                    <th>Description</th>
                    <th>Year</th>
                    <th>Status</th>
                    <th>Lock</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.map((program) => {
                    const id = String(program._id);
                    const busy = String(busyMap[id] || "");
                    return (
                      <tr key={id}>
                        <td>
                          <div className="fw-semibold">{program.programCode || program.name}</div>
                          <div className="small text-muted">{program.programName || "Untitled Program"}</div>
                        </td>
                        <td>{program.description || program.departmentName || "N/A"}</td>
                        <td>{program.year || "N/A"}</td>
                        <td>
                          <span className="badge text-bg-secondary d-inline-flex align-items-center gap-1">
                            <FaArchive />
                            {program.workflowStatus || "Archived"}
                          </span>
                        </td>
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
                                navigate(`/admin/copc-dashboard?tab=workflow&programId=${encodeURIComponent(id)}`)
                              }
                            >
                              <FaEye className="me-1" />
                              Open
                            </button>
                            <button
                              className="btn btn-sm btn-success"
                              disabled={busy.length > 0}
                              onClick={() => handleUnarchive(program)}
                            >
                              <FaUndoAlt className="me-1" />
                              {busy === "unarchive" ? "Unarchiving..." : "Unarchive"}
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
