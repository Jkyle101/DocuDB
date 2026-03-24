import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaCloudUploadAlt, FaRedoAlt, FaSearch, FaUsers } from "react-icons/fa";
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

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
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

  if (!canViewActivity) {
    return <div className="alert alert-danger">Only super admin, dept chair, or QA admin can view COPC upload activity.</div>;
  }

  return (
    <div className="container-fluid py-2">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Recent COPC Upload Activity</h4>
          <div className="small text-muted">
            Track who uploaded the newest COPC files, when they uploaded, and where files were placed.
          </div>
        </div>
        <button
          className="btn btn-outline-primary"
          onClick={() => loadUploads({ silent: false })}
          disabled={loading || refreshing}
        >
          <FaRedoAlt className="me-1" />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Uploads Shown</div>
              <div className="fw-bold fs-4">{stats.shownUploads}</div>
              <div className="small text-muted">Total matching files: {stats.totalUploads}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Unique Uploaders</div>
              <div className="fw-bold fs-4">{stats.uniqueUploaders}</div>
              <div className="small text-muted">Top list updates with filters</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Latest Upload</div>
              <div className="fw-semibold">{formatDateTime(stats.latestUploadDate)}</div>
              <div className="small text-muted">Newest file in this result set</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted">Generated</div>
              <div className="fw-semibold">{formatDateTime(meta.generatedAt)}</div>
              <div className="small text-muted">{meta.hasMore ? "More files available" : "Showing latest available set"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2">
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
                    {program.programCode || program.name} - {program.programName || "Untitled"}{program.year ? ` (${program.year})` : ""}
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
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-header bg-light fw-semibold">
              <FaCloudUploadAlt className="me-2" />
              Newest COPC Files ({filteredUploads.length})
            </div>
            <div className="card-body p-0">
              {loading && <div className="p-3 small text-muted">Loading upload activity...</div>}
              {!loading && filteredUploads.length === 0 && (
                <div className="p-3 text-muted">No COPC uploads found for this filter.</div>
              )}
              {!loading && filteredUploads.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
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
                              {(row.uploadedBy?.role || "N/A").replace(/_/g, " ")}
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
                          <td className="small text-muted">{row.folderPath || "Program Root"}</td>
                          <td>
                            <span className={`badge ${reviewStatusClass(row.reviewStatus)}`}>
                              {reviewStatusLabel(row.reviewStatus)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm">
            <div className="card-header bg-light fw-semibold">
              <FaUsers className="me-2" />
              Top Uploaders (Current Set)
            </div>
            <div className="card-body">
              {topUploaders.length === 0 && (
                <div className="small text-muted">No uploader activity available.</div>
              )}
              {topUploaders.length > 0 && (
                <div className="list-group list-group-flush">
                  {topUploaders.map((uploader) => (
                    <div key={`${uploader.id || uploader.email}`} className="list-group-item px-0">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-semibold">{uploader.name || "Unknown User"}</div>
                          <div className="small text-muted">{uploader.email || "No email available"}</div>
                          <div className="small text-muted">
                            {(uploader.role || "N/A").replace(/_/g, " ")}
                            {uploader.department ? ` | ${uploader.department}` : ""}
                          </div>
                        </div>
                        <span className="badge text-bg-primary">{uploader.count}</span>
                      </div>
                      <div className="small text-muted mt-1">Latest: {formatDateTime(uploader.latestUploadDate)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
