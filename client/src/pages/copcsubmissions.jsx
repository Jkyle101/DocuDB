import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaArrowLeft, FaCloudDownloadAlt, FaEye } from "react-icons/fa";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../config";

const DEFAULT_COUNTS = {
  submitted: 0,
  pendingProgramChair: 0,
  pendingQa: 0,
  rejected: 0,
  approved: 0,
};

const normalizeSubmissionStatus = (value) => {
  const key = String(value || "all").toLowerCase();
  if (!key || key === "submitted") return "all";
  if (["rejected_revision", "rejected/revision", "revision", "rejected_for_revision"].includes(key)) {
    return "rejected";
  }
  if (["all", "pending_program_chair", "pending_qa", "rejected", "approved"].includes(key)) {
    return key;
  }
  return "all";
};

const workflowStatusMeta = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return { label: "Approved", className: "bg-success" };
  if (key === "pending_program_chair") return { label: "Pending Dept Review", className: "bg-warning text-dark" };
  if (key === "pending_qa") return { label: "Pending QA", className: "bg-primary" };
  if (key === "rejected_program_chair") return { label: "Revision Needed (Dept)", className: "bg-danger" };
  if (key === "rejected_qa") return { label: "Revision Needed (QA)", className: "bg-danger" };
  return { label: "In Review", className: "bg-secondary" };
};

const reviewerStatusMeta = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return { label: "Approved", className: "text-success" };
  if (key === "rejected") return { label: "Rejected", className: "text-danger" };
  if (key === "pending") return { label: "Pending", className: "text-warning" };
  if (key === "not_required") return { label: "N/A", className: "text-muted" };
  return { label: "N/A", className: "text-muted" };
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

export default function CopcSubmissionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const requestedProgramId = String(searchParams.get("programId") || "");
  const requestedStatus = normalizeSubmissionStatus(searchParams.get("status"));
  const normalizedRole = String(role || "").toLowerCase();

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(requestedProgramId);
  const [statusFilter, setStatusFilter] = useState(requestedStatus);
  const [statusSearch, setStatusSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const [metadataTarget, setMetadataTarget] = useState(null);

  const isAdminPath = location.pathname.startsWith("/admin/");
  const isUserScopedView = !["superadmin", "admin"].includes(normalizedRole);
  const tableStatusLabel =
    statusFilter === "all"
      ? "All submitted files"
      : statusFilter === "pending_program_chair"
        ? "Pending department review"
        : statusFilter === "pending_qa"
          ? "Pending QA review"
          : statusFilter === "rejected"
            ? "Rejected / for revision"
            : "Approved";

  const syncQuery = (programId, status) => {
    const params = new URLSearchParams(searchParams);
    if (programId) params.set("programId", String(programId));
    else params.delete("programId");
    const normalizedStatus = normalizeSubmissionStatus(status);
    if (normalizedStatus === "all") params.delete("status");
    else params.set("status", normalizedStatus);
    setSearchParams(params, { replace: true });
  };

  const loadPrograms = async () => {
    const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, { params: { userId, role } });
    const list = Array.isArray(data) ? data : [];
    setPrograms(list);

    const requestedExists = requestedProgramId && list.some((item) => String(item._id) === requestedProgramId);
    const selectedExists = selectedProgramId && list.some((item) => String(item._id) === selectedProgramId);

    let nextProgramId = "";
    if (requestedExists) nextProgramId = requestedProgramId;
    else if (selectedExists) nextProgramId = selectedProgramId;
    else if (list.length > 0) nextProgramId = String(list[0]._id);

    setSelectedProgramId(nextProgramId);
    if (nextProgramId !== requestedProgramId) {
      syncQuery(nextProgramId, statusFilter);
    }
  };

  const loadSubmissions = async (programId, filter) => {
    if (!programId) {
      setSubmissions([]);
      setCounts(DEFAULT_COUNTS);
      setLoadError("");
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/submissions`, {
        params: {
          userId,
          role,
          status: normalizeSubmissionStatus(filter),
        },
      });
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
      setCounts(data?.counts || DEFAULT_COUNTS);
    } catch (err) {
      setSubmissions([]);
      setCounts(DEFAULT_COUNTS);
      setLoadError(String(err?.response?.data?.error || err?.message || "Failed to load submissions"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms().catch(() => setPrograms([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nextStatus = normalizeSubmissionStatus(searchParams.get("status"));
    if (nextStatus !== statusFilter) setStatusFilter(nextStatus);
    const nextProgramId = String(searchParams.get("programId") || "");
    if (nextProgramId && nextProgramId !== selectedProgramId) {
      setSelectedProgramId(nextProgramId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    loadSubmissions(selectedProgramId, statusFilter).catch(() => {
      setSubmissions([]);
      setCounts(DEFAULT_COUNTS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, statusFilter]);

  const filteredSubmissions = useMemo(() => {
    const query = statusSearch.trim().toLowerCase();
    if (!query) return submissions;
    return submissions.filter((item) => {
      const fileName = String(item?.originalName || "").toLowerCase();
      const folderName = String(item?.folderName || "").toLowerCase();
      const uploader = String(item?.uploaderName || item?.uploaderEmail || "").toLowerCase();
      const statusLabel = String(workflowStatusMeta(item?.workflowStatus).label || "").toLowerCase();
      return (
        fileName.includes(query) ||
        folderName.includes(query) ||
        uploader.includes(query) ||
        statusLabel.includes(query)
      );
    });
  }, [statusSearch, submissions]);

  const statusCards = [
    {
      key: "all",
      label: "Submitted Docs",
      hint: "All records",
      value: Number(counts.submitted || 0),
      toneClass: "text-primary",
    },
    {
      key: "pending_program_chair",
      label: "Pending Dept Review",
      hint: "For department validation",
      value: Number(counts.pendingProgramChair || 0),
      toneClass: "text-warning",
    },
    {
      key: "pending_qa",
      label: "Pending QA",
      hint: "Awaiting QA decision",
      value: Number(counts.pendingQa || 0),
      toneClass: "text-info",
    },
    {
      key: "rejected",
      label: "Rejected / Revision",
      hint: "Needs fixes",
      value: Number(counts.rejected || 0),
      toneClass: "text-danger",
    },
  ];

  const openWorkflow = () => {
    const params = new URLSearchParams({ tab: "workflow" });
    if (selectedProgramId) params.set("programId", selectedProgramId);
    const base = isAdminPath ? "/admin/copc-dashboard" : "/copc-dashboard";
    navigate(`${base}?${params.toString()}`);
  };

  return (
    <div className="container-fluid py-2">
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h4 className="mb-1">Submitted Documents</h4>
            <div className="small text-muted">Program-level submission tracker for department and QA workflow states.</div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button className="btn btn-outline-secondary" onClick={openWorkflow}>
              <FaArrowLeft className="me-1" />
              Back to Workflow
            </button>
            <select
              className="form-select"
              style={{ minWidth: "280px", maxWidth: "420px" }}
              value={selectedProgramId}
              onChange={(e) => {
                const nextProgramId = String(e.target.value || "");
                setSelectedProgramId(nextProgramId);
                syncQuery(nextProgramId, statusFilter);
              }}
            >
              <option value="">Select Program</option>
              {programs.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.programCode || program.name} - {program.programName || program.name} ({program.year || "N/A"})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedProgramId && (
        <div className="alert alert-info">Select a COPC program to view submitted documents.</div>
      )}

      {selectedProgramId && (
        <>
          <div className="row g-3 mb-3">
            {statusCards.map((card) => {
              const isActive = statusFilter === card.key;
              return (
                <div key={card.key} className="col-xl-3 col-md-6">
                  <button
                    type="button"
                    className={`card shadow-sm h-100 text-start w-100 ${isActive ? "border-primary border-2" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setStatusFilter(card.key);
                      syncQuery(selectedProgramId, card.key);
                    }}
                  >
                    <div className="card-body">
                      <div className="small text-muted">{card.label}</div>
                      <div className={`fw-bold fs-4 ${card.toneClass}`}>{card.value}</div>
                      <div className="small text-muted">{card.hint}</div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="card shadow-sm">
            <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="small fw-semibold">{tableStatusLabel}</div>
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: "360px" }}
                placeholder="Search document, folder, uploader, or status"
                value={statusSearch}
                onChange={(e) => setStatusSearch(e.target.value)}
              />
            </div>
            <div className="card-body py-2">
              {!loading && loadError && (
                <div className="alert alert-warning py-2 mb-2 small">
                  {loadError}
                </div>
              )}
              {loading && <div className="small text-muted">Loading submissions...</div>}
              {!loading && filteredSubmissions.length === 0 && (
                <div className="small text-muted">
                  {isUserScopedView
                    ? "No documents uploaded by your account for this filter yet."
                    : "No documents found for this filter."}
                </div>
              )}
              {!loading && filteredSubmissions.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Document</th>
                        <th>Folder</th>
                        <th>Uploaded By</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Dept Review</th>
                        <th>QA</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((item) => {
                        const workflow = workflowStatusMeta(item.workflowStatus);
                        const chair = reviewerStatusMeta(item.programChairStatus);
                        const qa = reviewerStatusMeta(item.qaStatus);
                        const revisionNote = String(item.programChairNotes || item.qaNotes || "").trim();
                        return (
                          <tr key={`submission-${item._id}`}>
                            <td>
                              <button
                                type="button"
                                className="btn btn-link p-0 text-start fw-semibold text-decoration-none text-truncate"
                                style={{ maxWidth: "280px" }}
                                title={`Open metadata: ${item.originalName}`}
                                onClick={() => setMetadataTarget(item)}
                              >
                                {item.originalName}
                              </button>
                              <div className="small text-muted">{formatFileSize(item.size)}</div>
                              {revisionNote && (
                                <div className="small text-danger text-truncate" style={{ maxWidth: "280px" }} title={revisionNote}>
                                  Note: {revisionNote}
                                </div>
                              )}
                            </td>
                            <td className="small">{item.folderName || "Unknown Folder"}</td>
                            <td className="small">
                              <div className="fw-semibold">{item.uploaderName || "Unknown uploader"}</div>
                              {item.uploaderEmail && <div className="text-muted">{item.uploaderEmail}</div>}
                            </td>
                            <td className="small">
                              {item.uploadDate ? new Date(item.uploadDate).toLocaleString() : "N/A"}
                            </td>
                            <td>
                              <span className={`badge ${workflow.className}`}>{workflow.label}</span>
                            </td>
                            <td className={`small fw-semibold ${chair.className}`}>{chair.label}</td>
                            <td className={`small fw-semibold ${qa.className}`}>{qa.label}</td>
                            <td className="text-center">
                              <div className="d-flex justify-content-center gap-1">
                                <a
                                  className="btn btn-sm btn-outline-primary"
                                  href={`${BACKEND_URL}/preview/${item.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Preview file"
                                >
                                  <FaEye />
                                </a>
                                <a
                                  className="btn btn-sm btn-outline-success"
                                  href={`${BACKEND_URL}/download/${item.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                                  title="Download file"
                                >
                                  <FaCloudDownloadAlt />
                                </a>
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
        </>
      )}
      {metadataTarget &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal d-block app-modal-overlay"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            onClick={(event) => {
              if (event.target === event.currentTarget) setMetadataTarget(null);
            }}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Document Metadata</h5>
                  <button type="button" className="btn-close" onClick={() => setMetadataTarget(null)} />
                </div>
                <div className="modal-body">
                  {(() => {
                    const workflow = workflowStatusMeta(metadataTarget.workflowStatus);
                    const chair = reviewerStatusMeta(metadataTarget.programChairStatus);
                    const qa = reviewerStatusMeta(metadataTarget.qaStatus);
                    const deptNote = String(metadataTarget.programChairNotes || "").trim();
                    const qaNote = String(metadataTarget.qaNotes || "").trim();
                    const mainNote = qaNote || deptNote;
                    const tags = Array.isArray(metadataTarget?.classification?.tags)
                      ? metadataTarget.classification.tags.filter(Boolean)
                      : [];

                    return (
                      <>
                        {mainNote && (
                          <div className="alert alert-warning py-2 small">
                            <div className="fw-semibold">Review Note</div>
                            <div>{mainNote}</div>
                          </div>
                        )}
                        <div className="row g-3">
                          <div className="col-md-6">
                            <div className="small text-muted">Document Name</div>
                            <div className="fw-semibold">{metadataTarget.originalName || "N/A"}</div>
                          </div>
                          <div className="col-md-6">
                            <div className="small text-muted">Folder</div>
                            <div className="fw-semibold">{metadataTarget.folderName || "Unknown Folder"}</div>
                          </div>
                          <div className="col-md-6">
                            <div className="small text-muted">Uploaded By</div>
                            <div className="fw-semibold">{metadataTarget.uploaderName || "Unknown uploader"}</div>
                            {metadataTarget.uploaderEmail && (
                              <div className="small text-muted">{metadataTarget.uploaderEmail}</div>
                            )}
                          </div>
                          <div className="col-md-6">
                            <div className="small text-muted">Upload Date</div>
                            <div className="fw-semibold">
                              {metadataTarget.uploadDate ? new Date(metadataTarget.uploadDate).toLocaleString() : "N/A"}
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="small text-muted">File Size</div>
                            <div className="fw-semibold">{formatFileSize(metadataTarget.size)}</div>
                          </div>
                          <div className="col-md-4">
                            <div className="small text-muted">MIME Type</div>
                            <div className="fw-semibold text-break">{metadataTarget.mimetype || "N/A"}</div>
                          </div>
                          <div className="col-md-4">
                            <div className="small text-muted">Workflow Status</div>
                            <div><span className={`badge ${workflow.className}`}>{workflow.label}</span></div>
                          </div>
                          <div className="col-md-6">
                            <div className="small text-muted">Department Review</div>
                            <div className={`fw-semibold ${chair.className}`}>{chair.label}</div>
                            <div className="small text-muted mt-1">
                              {deptNote || "No department note."}
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="small text-muted">QA Review</div>
                            <div className={`fw-semibold ${qa.className}`}>{qa.label}</div>
                            <div className="small text-muted mt-1">
                              {qaNote || "No QA note."}
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="small text-muted">Classification</div>
                            <div className="small">
                              Category: <strong>{metadataTarget?.classification?.category || "N/A"}</strong>
                            </div>
                            <div className="small">
                              Confidence: <strong>{Number(metadataTarget?.classification?.confidence || 0).toFixed(2)}</strong>
                            </div>
                            <div className="small">
                              Tags: {tags.length ? tags.join(", ") : "None"}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="modal-footer">
                  <a
                    className="btn btn-outline-primary"
                    href={`${BACKEND_URL}/preview/${metadataTarget.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FaEye className="me-1" />
                    Preview
                  </a>
                  <a
                    className="btn btn-outline-success"
                    href={`${BACKEND_URL}/download/${metadataTarget.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                  >
                    <FaCloudDownloadAlt className="me-1" />
                    Download
                  </a>
                  <button type="button" className="btn btn-secondary" onClick={() => setMetadataTarget(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
