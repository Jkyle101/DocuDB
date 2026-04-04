import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaCalendarAlt,
  FaCloudUploadAlt,
  FaDatabase,
  FaFileAlt,
  FaFilter,
  FaFolderOpen,
  FaRedoAlt,
  FaSearch,
  FaUsers,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";
import "./admincopcrecentuploads.css";

function normalizeRole(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "admin") return "superadmin";
  if (raw === "faculty") return "user";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  if (raw === "reviewer") return "evaluator";
  return raw;
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) return "N/A";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "N/A";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "Just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(value);
}

function formatBytes(size) {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const normalized = value / (1024 ** exponent);
  return `${normalized.toFixed(normalized >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function reviewStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const map = {
    approved: "Approved",
    pending_program_chair: "Pending Dept Chair",
    pending_qa: "Pending QA",
    rejected_program_chair: "Rejected by Dept Chair",
    rejected_qa: "Rejected by QA",
  };
  return map[key] || (key ? key.replace(/_/g, " ") : "N/A");
}

function reviewStatusClass(status) {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return "text-bg-success";
  if (key === "pending_program_chair" || key === "pending_qa") return "text-bg-warning";
  if (key === "rejected_program_chair" || key === "rejected_qa") return "text-bg-danger";
  return "text-bg-light border";
}

function formatRole(value) {
  const raw = String(value || "").trim();
  if (!raw) return "N/A";
  return raw.replace(/_/g, " ").replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function uploaderInitials(name, email) {
  const source = String(name || "").trim() || String(email || "").trim() || "User";
  const tokens = source.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

function buildTopUploaders(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row?.uploadedBy?.id || row?.uploadedBy?.email || "").trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        id: row?.uploadedBy?.id || "",
        name: row?.uploadedBy?.name || "",
        email: row?.uploadedBy?.email || "",
        role: row?.uploadedBy?.role || "",
        department: row?.uploadedBy?.department || "",
        count: 0,
        latestUploadDate: row?.uploadDate || null,
      });
    }
    const current = map.get(key);
    current.count += 1;
    const currentTs = new Date(current.latestUploadDate || 0).getTime();
    const nextTs = new Date(row?.uploadDate || 0).getTime();
    if (nextTs > currentTs) current.latestUploadDate = row?.uploadDate || current.latestUploadDate;
  }
  return Array.from(map.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.latestUploadDate || 0).getTime() - new Date(a.latestUploadDate || 0).getTime();
    })
    .slice(0, 10);
}

export default function AdminCopcRecentUploadsPage() {
  const role = localStorage.getItem("role") || "superadmin";
  const userId = localStorage.getItem("userId");
  const normalizedRole = useMemo(() => normalizeRole(role), [role]);
  const canViewActivity = ["superadmin", "dept_chair", "qa_admin"].includes(normalizedRole);

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState([]);
  const [topUploaders, setTopUploaders] = useState([]);
  const [meta, setMeta] = useState({ total: 0, hasMore: false, generatedAt: null });

  const loadPrograms = async () => {
    if (!userId) {
      setPrograms([]);
      return;
    }
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, {
        params: { userId, role },
      });
      setPrograms(Array.isArray(data) ? data : []);
    } catch {
      setPrograms([]);
    }
  };

  const loadUploads = async ({ silent = false } = {}) => {
    if (!userId) {
      setUploads([]);
      setTopUploaders([]);
      setMeta({ total: 0, hasMore: false, generatedAt: null });
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${BACKEND_URL}/admin/copc/recent-uploads`, {
        params: {
          userId,
          role,
          programId: selectedProgramId || undefined,
          limit,
          page: 1,
        },
      });
      setUploads(Array.isArray(data?.uploads) ? data.uploads : []);
      setTopUploaders(Array.isArray(data?.topUploaders) ? data.topUploaders : []);
      setMeta({
        total: Number(data?.total || 0),
        hasMore: !!data?.hasMore,
        generatedAt: data?.generatedAt || null,
      });
    } catch (err) {
      // Backward-compatible fallback: older backend may not have /admin/copc/recent-uploads yet.
      if (err?.response?.status === 404) {
        try {
          const programsRes = await axios.get(`${BACKEND_URL}/copc/programs`, {
            params: { userId, role },
          });
          const allPrograms = Array.isArray(programsRes.data) ? programsRes.data : [];
          const scopedPrograms = selectedProgramId
            ? allPrograms.filter((program) => String(program?._id || "") === String(selectedProgramId))
            : allPrograms;

          const submissionResults = await Promise.allSettled(
            scopedPrograms.map((program) =>
              axios.get(`${BACKEND_URL}/copc/programs/${program._id}/submissions`, {
                params: { userId, role, status: "all" },
              })
            )
          );

          const rows = [];
          submissionResults.forEach((result, index) => {
            if (result.status !== "fulfilled") return;
            const payload = result.value?.data || {};
            const programMeta = payload?.program || scopedPrograms[index] || {};
            const submissions = Array.isArray(payload?.submissions) ? payload.submissions : [];
            submissions.forEach((submission) => {
              rows.push({
                fileId: String(submission?._id || ""),
                originalName: String(submission?.originalName || submission?.filename || "Untitled File"),
                filename: String(submission?.filename || ""),
                mimetype: String(submission?.mimetype || ""),
                size: Number(submission?.size || 0),
                uploadDate: submission?.uploadDate || null,
                reviewStatus: String(submission?.workflowStatus || ""),
                parentFolderId: String(submission?.folderId || ""),
                folderPath: String(submission?.folderName || ""),
                program: {
                  id: String(programMeta?._id || ""),
                  code: String(programMeta?.code || programMeta?.programCode || ""),
                  name: String(programMeta?.name || programMeta?.programName || ""),
                  year: programMeta?.year ?? null,
                },
                uploadedBy: {
                  id: String(submission?.uploaderId || ""),
                  name: String(submission?.uploaderName || "").trim(),
                  email: String(submission?.uploaderEmail || "").trim(),
                  role: "",
                  department: "",
                },
              });
            });
          });

          rows.sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime());
          const sliced = rows.slice(0, Math.max(1, Number(limit) || 50));
          setUploads(sliced);
          setTopUploaders(buildTopUploaders(sliced));
          setMeta({
            total: rows.length,
            hasMore: rows.length > sliced.length,
            generatedAt: new Date().toISOString(),
          });
          setError("");
        } catch (fallbackErr) {
          setError(fallbackErr?.response?.data?.error || "Failed to load recent COPC uploads.");
          setUploads([]);
          setTopUploaders([]);
          setMeta({ total: 0, hasMore: false, generatedAt: null });
        }
      } else {
        setError(err?.response?.data?.error || "Failed to load recent COPC uploads.");
        setUploads([]);
        setTopUploaders([]);
        setMeta({ total: 0, hasMore: false, generatedAt: null });
      }
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, limit]);

  const filteredUploads = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return uploads;
    return uploads.filter((row) => {
      const file = String(row?.originalName || "").toLowerCase();
      const uploaderName = String(row?.uploadedBy?.name || "").toLowerCase();
      const uploaderEmail = String(row?.uploadedBy?.email || "").toLowerCase();
      const programCode = String(row?.program?.code || "").toLowerCase();
      const programName = String(row?.program?.name || "").toLowerCase();
      const folderPath = String(row?.folderPath || "").toLowerCase();
      return (
        file.includes(q) ||
        uploaderName.includes(q) ||
        uploaderEmail.includes(q) ||
        programCode.includes(q) ||
        programName.includes(q) ||
        folderPath.includes(q)
      );
    });
  }, [uploads, search]);

  const stats = useMemo(() => {
    const uniqueUploaderKeys = new Set(
      uploads
        .map((row) => String(row?.uploadedBy?.id || row?.uploadedBy?.email || "").trim())
        .filter(Boolean)
    );
    const latest = uploads.length > 0 ? uploads[0]?.uploadDate || null : null;
    return {
      shownUploads: uploads.length,
      totalUploads: Number(meta.total || 0),
      uniqueUploaders: uniqueUploaderKeys.size,
      latestUploadDate: latest,
    };
  }, [uploads, meta.total]);

  const isBusy = loading || refreshing;
  const coveragePercent = useMemo(() => {
    if (!stats.totalUploads) return 0;
    return Math.min(100, Math.round((stats.shownUploads / stats.totalUploads) * 100));
  }, [stats.shownUploads, stats.totalUploads]);

  const resetFilters = () => {
    setSelectedProgramId("");
    setLimit(50);
    setSearch("");
  };

  if (!canViewActivity) {
    return <div className="alert alert-danger">Only super admin, dept chair, or QA admin can view COPC upload activity.</div>;
  }

  return (
    <div className="container-fluid py-3 copc-recent-ui">
      <div className="copc-recent-shell">
        <header className="copc-recent-header">
          <div>
            <p className="copc-recent-kicker mb-2">COPC Monitoring</p>
            <h4 className="copc-recent-title mb-1">Recent COPC Upload Activity</h4>
            <p className="copc-recent-subtitle mb-0">
              Real-time visibility into new COPC submissions, uploader activity, and storage placement.
            </p>
          </div>
          <div className="copc-recent-header-actions">
            <div className="copc-meta-pill">
              <FaCalendarAlt />
              <span>{formatDateTime(meta.generatedAt)}</span>
            </div>
            <button
              className="btn btn-primary copc-refresh-btn"
              onClick={() => loadUploads({ silent: false })}
              disabled={isBusy}
            >
              <FaRedoAlt className={`me-2 ${isBusy ? "copc-icon-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </header>

        <section className="copc-stat-grid" aria-label="COPC upload overview">
          <article className="copc-stat-card">
            <span className="copc-stat-icon tone-upload">
              <FaCloudUploadAlt />
            </span>
            <div className="copc-stat-label">Uploads Shown</div>
            <div className="copc-stat-value">{stats.shownUploads.toLocaleString()}</div>
            <div className="copc-stat-meta">Total matching files: {stats.totalUploads.toLocaleString()}</div>
          </article>
          <article className="copc-stat-card">
            <span className="copc-stat-icon tone-users">
              <FaUsers />
            </span>
            <div className="copc-stat-label">Unique Uploaders</div>
            <div className="copc-stat-value">{stats.uniqueUploaders.toLocaleString()}</div>
            <div className="copc-stat-meta">Top uploader list updates by current dataset</div>
          </article>
          <article className="copc-stat-card">
            <span className="copc-stat-icon tone-latest">
              <FaDatabase />
            </span>
            <div className="copc-stat-label">Latest Upload</div>
            <div className="copc-stat-value">{formatRelativeTime(stats.latestUploadDate)}</div>
            <div className="copc-stat-meta">{formatDateTime(stats.latestUploadDate)}</div>
          </article>
          <article className="copc-stat-card is-accent">
            <span className="copc-stat-icon tone-generated">
              <FaCalendarAlt />
            </span>
            <div className="copc-stat-label">Dataset Window</div>
            <div className="copc-stat-value">{coveragePercent}%</div>
            <div className="copc-stat-meta">
              {meta.hasMore ? "Additional uploads exist beyond this row limit." : "Viewing all files in this query."}
            </div>
          </article>
        </section>

        <section className="copc-filter-surface">
          <div className="copc-filter-head">
            <div className="copc-filter-title">
              <FaFilter className="me-2" />
              Filter Activity
            </div>
            <button className="btn btn-link copc-clear-btn" type="button" onClick={resetFilters}>
              Clear All
            </button>
          </div>
          <div className="row g-2 align-items-end">
            <div className="col-lg-4 col-md-6">
              <label className="form-label small fw-semibold mb-1">Program</label>
              <select
                className="form-select"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
              >
                <option value="">All COPC Programs</option>
                {(programs || []).map((program) => (
                  <option key={program._id} value={program._id}>
                    {program.programCode || program.name} - {program.programName || "Untitled"}
                    {program.year ? ` (${program.year})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-md-6">
              <label className="form-label small fw-semibold mb-1">Rows</label>
              <select
                className="form-select"
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value) || 50)}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
            <div className="col-lg-6 col-md-12">
              <label className="form-label small fw-semibold mb-1">Search</label>
              <div className="input-group">
                <span className="input-group-text">
                  <FaSearch />
                </span>
                <input
                  className="form-control"
                  placeholder="Search file, uploader, program, or folder"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          {error && <div className="alert alert-danger mt-3 mb-0 py-2">{error}</div>}
        </section>

        <div className="row g-3">
          <div className="col-12 col-xl-8">
            <section className="card copc-main-panel">
              <div className="copc-panel-header">
                <div className="copc-panel-title">
                  <FaFileAlt className="me-2" />
                  Newest COPC Files
                </div>
                <span className="copc-panel-count">{filteredUploads.length} entries</span>
              </div>
              <div className="card-body p-0">
                {loading && <div className="p-3 small text-muted">Loading upload activity...</div>}
                {!loading && filteredUploads.length === 0 && (
                  <div className="p-3 text-muted">No COPC uploads found for this filter.</div>
                )}
                {!loading && filteredUploads.length > 0 && (
                  <>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0 copc-recent-table">
                        <thead className="table-light">
                          <tr>
                            <th>Uploaded At</th>
                            <th>File</th>
                            <th>Uploaded By</th>
                            <th>Program</th>
                            <th>Folder</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUploads.map((row) => (
                            <tr key={row.fileId}>
                              <td className="small text-nowrap">{formatDateTime(row.uploadDate)}</td>
                              <td>
                                <div className="fw-semibold">{row.originalName || "Untitled File"}</div>
                                <div className="small text-muted">{formatBytes(row.size)}</div>
                              </td>
                              <td>
                                <div className="fw-semibold">{row.uploadedBy?.name || "Unknown User"}</div>
                                <div className="small text-muted">{row.uploadedBy?.email || "No email available"}</div>
                                <div className="small text-muted">
                                  {formatRole(row.uploadedBy?.role)}
                                  {row.uploadedBy?.department ? ` | ${row.uploadedBy.department}` : ""}
                                </div>
                              </td>
                              <td>
                                <div className="fw-semibold">{row.program?.code || "N/A"}</div>
                                <div className="small text-muted">
                                  {row.program?.name || "Unknown Program"}
                                  {row.program?.year ? ` (${row.program.year})` : ""}
                                </div>
                              </td>
                              <td className="small text-muted">
                                <span className="copc-folder-chip">
                                  <FaFolderOpen className="me-1" />
                                  {row.folderPath || "Program Root"}
                                </span>
                              </td>
                              <td>
                                <span className={`badge copc-status-badge ${reviewStatusClass(row.reviewStatus)}`}>
                                  {reviewStatusLabel(row.reviewStatus)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="copc-table-footer">
                      <span>
                        Showing {filteredUploads.length.toLocaleString()} of {stats.totalUploads.toLocaleString()} uploads
                      </span>
                      <span>{meta.hasMore ? "More results available with this filter scope." : "Latest available set loaded."}</span>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          <div className="col-12 col-xl-4">
            <section className="card copc-side-panel mb-3">
              <div className="copc-panel-header">
                <div className="copc-panel-title">
                  <FaUsers className="me-2" />
                  Top Uploaders
                </div>
                <span className="copc-panel-count">Current Set</span>
              </div>
              <div className="card-body">
                {topUploaders.length === 0 && (
                  <div className="small text-muted">No uploader activity available.</div>
                )}
                {topUploaders.length > 0 && (
                  <div className="copc-uploader-list">
                    {topUploaders.map((uploader, index) => (
                      <div key={`${uploader.id || uploader.email}`} className="copc-uploader-item">
                        <div className="copc-uploader-avatar">
                          {uploaderInitials(uploader.name, uploader.email)}
                        </div>
                        <div className="copc-uploader-content">
                          <div className="copc-uploader-head">
                            <div className="fw-semibold">{uploader.name || "Unknown User"}</div>
                            <span className="copc-uploader-count">
                              {uploader.count} {uploader.count > 1 ? "files" : "file"}
                            </span>
                          </div>
                          <div className="small text-muted">{uploader.email || "No email available"}</div>
                          <div className="small text-muted">
                            #{index + 1} {formatRole(uploader.role)}
                            {uploader.department ? ` | ${uploader.department}` : ""}
                          </div>
                          <div className="small text-muted mt-1">Latest: {formatDateTime(uploader.latestUploadDate)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card copc-side-panel copc-system-panel">
              <div className="copc-panel-header">
                <div className="copc-panel-title">System Snapshot</div>
              </div>
              <div className="card-body">
                <div className="copc-health-row">
                  <span>Status</span>
                  <strong>{isBusy ? "Syncing" : "Stable"}</strong>
                </div>
                <div className="copc-health-row">
                  <span>Coverage</span>
                  <strong>{coveragePercent}%</strong>
                </div>
                <div className="copc-health-row">
                  <span>Program Scope</span>
                  <strong>{selectedProgramId ? "Filtered" : "All Programs"}</strong>
                </div>
                <div className="copc-health-bar" role="progressbar" aria-valuenow={coveragePercent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="copc-health-bar-fill" style={{ width: `${coveragePercent}%` }} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
