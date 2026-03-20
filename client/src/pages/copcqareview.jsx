import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaCheckSquare,
  FaChevronDown,
  FaChevronUp,
  FaDownload,
  FaEye,
  FaFolderOpen,
  FaFileAlt,
  FaList,
  FaRegSquare,
  FaTag,
  FaTh,
  FaTimesCircle,
  FaUndo,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";

const CHECKLIST_ITEMS = [
  { key: "facultyQualification", label: "Faculty qualification compliance" },
  { key: "curriculumAlignment", label: "Curriculum alignment" },
  { key: "facilityDocumentation", label: "Facility documentation" },
  { key: "programRequirements", label: "Program requirements" },
];

const COMPLIANCE_CATEGORIES = [
  "Faculty Qualification Compliance",
  "Curriculum Alignment",
  "Facility Documentation",
  "Program Requirements",
  "Program Profile",
  "Administration",
  "Supporting Documents",
];

const normalizeQaStatusBadge = (status) => {
  if (status === "approved") return "bg-success";
  if (status === "rejected") return "bg-danger";
  return "bg-warning text-dark";
};

const formatSize = (bytes) => {
  const value = Number(bytes || 0);
  if (!value || Number.isNaN(value)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export default function CopcQaReviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "faculty";

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programMeta, setProgramMeta] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [submissions, setSubmissions] = useState([]);
  const [overallCounts, setOverallCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState("");
  const [reviewNotes, setReviewNotes] = useState({});
  const [tagDrafts, setTagDrafts] = useState({});
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const [loadingCompilation, setLoadingCompilation] = useState(false);
  const [runningCompile, setRunningCompile] = useState(false);
  const [compilationData, setCompilationData] = useState({
    program: null,
    counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
    folders: [],
  });
  const [checklist, setChecklist] = useState({
    facultyQualification: false,
    curriculumAlignment: false,
    facilityDocumentation: false,
    programRequirements: false,
  });
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(true);

  const checklistDone = useMemo(
    () => Object.values(checklist).filter(Boolean).length,
    [checklist]
  );

  const loadPrograms = async () => {
    const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, { params: { userId, role } });
    const list = Array.isArray(data) ? data : [];
    setPrograms(list);
    if (!list.length) {
      setSelectedProgramId("");
      return;
    }
    const queryProgramId = String(searchParams.get("programId") || "");
    const hasQueryProgram = queryProgramId && list.some((p) => String(p._id) === queryProgramId);
    setSelectedProgramId((prev) => {
      if (prev && list.some((p) => String(p._id) === String(prev))) return prev;
      if (hasQueryProgram) return queryProgramId;
      return String(list[0]._id);
    });
  };

  const loadSubmissions = async (programId, nextFilter = statusFilter) => {
    if (!programId) {
      setProgramMeta(null);
      setSubmissions([]);
      setOverallCounts({ pending: 0, approved: 0, rejected: 0 });
      return;
    }
    setLoading(true);
    try {
      const [filteredRes, allRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/copc/programs/${programId}/qa/submissions`, {
          params: { userId, role, status: nextFilter },
        }),
        axios.get(`${BACKEND_URL}/copc/programs/${programId}/qa/submissions`, {
          params: { userId, role, status: "all" },
        }),
      ]);
      setProgramMeta(filteredRes?.data?.program || null);
      setSubmissions(Array.isArray(filteredRes?.data?.submissions) ? filteredRes.data.submissions : []);
      setOverallCounts(allRes?.data?.counts || { pending: 0, approved: 0, rejected: 0 });
    } finally {
      setLoading(false);
    }
  };

  const loadCompilationData = async (programId) => {
    if (!programId) {
      setCompilationData({
        program: null,
        counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
        folders: [],
      });
      return;
    }
    setLoadingCompilation(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/compilation/approved-tree`, {
        params: { userId, role },
      });
      setCompilationData({
        program: data?.program || null,
        counts: data?.counts || { approvedFiles: 0, foldersWithApprovedFiles: 0 },
        folders: Array.isArray(data?.folders) ? data.folders : [],
      });
    } catch {
      setCompilationData({
        program: null,
        counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
        folders: [],
      });
    } finally {
      setLoadingCompilation(false);
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
    loadSubmissions(selectedProgramId, statusFilter).catch(() => {
      setProgramMeta(null);
      setSubmissions([]);
      setOverallCounts({ pending: 0, approved: 0, rejected: 0 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, statusFilter]);

  useEffect(() => {
    loadCompilationData(selectedProgramId).catch(() => {
      setCompilationData({
        program: null,
        counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
        folders: [],
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  const filteredSubmissions = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((item) => {
      const name = String(item.originalName || "").toLowerCase();
      const folder = String(item.folderName || "").toLowerCase();
      const category = String(item.classification?.category || "").toLowerCase();
      const status = String(item.qaStatus || "").toLowerCase();
      return name.includes(q) || folder.includes(q) || category.includes(q) || status.includes(q);
    });
  }, [query, submissions]);

  const setChecklistValue = (key) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setDraft = (fileId, key, value) => {
    setTagDrafts((prev) => ({
      ...prev,
      [fileId]: {
        ...(prev[fileId] || {}),
        [key]: value,
      },
    }));
  };

  const handleReview = async (submission, action) => {
    if (!submission?._id) return;
    let notes = String(reviewNotes[submission._id] || "").trim();
    if (action === "reject" && !notes) {
      const promptValue = window.prompt("Add rejection note (optional):", "");
      if (promptValue === null) return;
      notes = String(promptValue || "").trim();
    }

    setActingId(`${submission._id}-${action}`);
    try {
      await axios.patch(`${BACKEND_URL}/files/${submission._id}/review/qa`, {
        userId,
        role,
        action,
        notes,
      });
      setReviewNotes((prev) => ({ ...prev, [submission._id]: "" }));
      await loadSubmissions(selectedProgramId, statusFilter);
      await loadCompilationData(selectedProgramId);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to process review action");
    } finally {
      setActingId("");
    }
  };

  const handleTagCategory = async (submission) => {
    if (!submission?._id) return;
    const draft = tagDrafts[submission._id] || {};
    const category = String(draft.category || submission.classification?.category || "").trim();
    const tagsText = String(draft.tags ?? (submission.classification?.tags || []).join(", ")).trim();
    if (!category) {
      alert("Select or enter a compliance category first.");
      return;
    }
    setActingId(`${submission._id}-tag`);
    try {
      await axios.patch(`${BACKEND_URL}/files/${submission._id}/review/qa/tag-category`, {
        userId,
        role,
        category,
        tags: tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      await loadSubmissions(selectedProgramId, statusFilter);
      await loadCompilationData(selectedProgramId);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to tag compliance category");
    } finally {
      setActingId("");
    }
  };

  const runCompile = async () => {
    if (!selectedProgramId) return;
    setRunningCompile(true);
    try {
      await axios.post(`${BACKEND_URL}/copc/programs/${selectedProgramId}/actions`, {
        userId,
        role,
        action: "compile_package",
      });
      await loadCompilationData(selectedProgramId);
      alert("COPC package generated successfully.");
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to generate COPC package");
    } finally {
      setRunningCompile(false);
    }
  };

  const downloadPackage = () => {
    if (!selectedProgramId) return;
    const url = `${BACKEND_URL}/copc/programs/${selectedProgramId}/package/download?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
    window.open(url, "_blank");
  };

  const renderTagControls = (submission) => {
    const draft = tagDrafts[submission._id] || {};
    const category = draft.category ?? submission.classification?.category ?? "";
    const tags = draft.tags ?? (submission.classification?.tags || []).join(", ");
    return (
      <div className="d-flex flex-column gap-1">
        <select
          className="form-select form-select-sm"
          value={category}
          onChange={(e) => setDraft(submission._id, "category", e.target.value)}
        >
          <option value="">Select Compliance Category</option>
          {COMPLIANCE_CATEGORIES.map((item) => (
            <option key={`${submission._id}-${item}`} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          className="form-control form-control-sm"
          placeholder="Tags (comma-separated)"
          value={tags}
          onChange={(e) => setDraft(submission._id, "tags", e.target.value)}
        />
        <button
          className="btn btn-sm btn-outline-secondary"
          disabled={actingId === `${submission._id}-tag`}
          onClick={() => handleTagCategory(submission)}
        >
          <FaTag className="me-1" /> Tag Compliance Category
        </button>
      </div>
    );
  };

  const goBackToDashboard = () => {
    const params = new URLSearchParams({ tab: "workflow" });
    if (selectedProgramId) params.set("programId", String(selectedProgramId));
    navigate(`/copc-dashboard?${params.toString()}`);
  };

  return (
    <div className="container-fluid py-3 file-manager-container">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary" onClick={goBackToDashboard}>
            <FaArrowLeft className="me-1" /> Back
          </button>
          <h4 className="mb-0">QA Compliance Review</h4>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <select
            className="form-select"
            style={{ minWidth: "260px", width: "100%", maxWidth: "460px" }}
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
          >
            <option value="">Select Program</option>
            {programs.map((program) => (
              <option key={program._id} value={program._id}>
                {program.programCode || program.name} - {program.programName || program.name} ({program.year || "N/A"})
              </option>
            ))}
          </select>
          <div className="btn-group" role="group">
            <button
              className={`btn ${view === "grid" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setView("grid")}
              title="Grid View"
            >
              <FaTh />
            </button>
            <button
              className={`btn ${view === "list" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setView("list")}
              title="List View"
            >
              <FaList />
            </button>
          </div>
        </div>
      </div>

      {!selectedProgramId && (
        <div className="alert alert-info">Select a COPC program to start QA compliance review.</div>
      )}

      {selectedProgramId && programMeta && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-semibold">{programMeta.code} - {programMeta.name}</div>
                <div className="small text-muted">{programMeta.description || "No description"} | AY {programMeta.year || "N/A"}</div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge text-bg-light border">Pending: {overallCounts.pending}</span>
                <span className="badge text-bg-light border">Approved: {overallCounts.approved}</span>
                <span className="badge text-bg-light border">Rejected: {overallCounts.rejected}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProgramId && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-light fw-semibold">COPC Compilation Stage</div>
          <div className="card-body">
            <div className="small text-muted mb-2">
              QA Admin compiles verified documents into a COPC submission package.
            </div>
            <div className="d-flex flex-wrap gap-2 mb-2">
              <button
                className="btn btn-primary"
                onClick={runCompile}
                disabled={runningCompile || !selectedProgramId}
              >
                <FaFolderOpen className="me-1" />
                {runningCompile ? "Generating..." : "Generate COPC Package"}
              </button>
              <button
                className="btn btn-outline-dark"
                onClick={downloadPackage}
                disabled={!selectedProgramId}
              >
                <FaDownload className="me-1" />
                Download {compilationData?.program?.packageFileName || "COPC Package"}
              </button>
              <span className="badge text-bg-light border align-self-center">
                Approved Files: {compilationData.counts.approvedFiles || 0}
              </span>
              <span className="badge text-bg-light border align-self-center">
                Folders: {compilationData.counts.foldersWithApprovedFiles || 0}
              </span>
            </div>
            {loadingCompilation && <div className="small text-muted">Loading approved folder structure...</div>}
            {!loadingCompilation && (!compilationData.folders || compilationData.folders.length === 0) && (
              <div className="small text-muted">
                No fully approved files yet. Files appear here after Dept Chair and QA both approve.
              </div>
            )}
            {!loadingCompilation && Array.isArray(compilationData.folders) && compilationData.folders.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Folder</th>
                      <th>Approved Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compilationData.folders.map((folder) => (
                      <tr key={`compile-${folder.folderPath || "root"}`}>
                        <td className="small fw-semibold">{folder.folderPath || "Root"}</td>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            {(folder.files || []).map((file) => (
                              <div key={`compile-file-${file._id}`} className="d-flex align-items-center justify-content-between gap-2 small border rounded px-2 py-1">
                                <span className="text-truncate" style={{ maxWidth: "420px" }} title={file.originalName}>
                                  {file.originalName}
                                </span>
                                <a
                                  className="btn btn-sm btn-outline-primary"
                                  href={`${BACKEND_URL}/preview/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <FaEye />
                                </a>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProgramId && (
        <div className="card shadow-sm mb-3" style={{ maxWidth: "560px" }}>
          <div className="card-header bg-light py-2">
            <div className="d-flex justify-content-between align-items-center">
              <div className="small fw-semibold">Compliance Checklist</div>
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">{checklistDone}/{CHECKLIST_ITEMS.length}</span>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setIsChecklistCollapsed((prev) => !prev)}
                  title={isChecklistCollapsed ? "Expand checklist" : "Collapse checklist"}
                >
                  {isChecklistCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                </button>
              </div>
            </div>
          </div>
          {!isChecklistCollapsed && (
            <div className="card-body py-2">
              <div className="d-flex flex-column gap-1">
                {CHECKLIST_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="btn btn-sm btn-light border d-flex align-items-center justify-content-start gap-2 text-start"
                    onClick={() => setChecklistValue(item.key)}
                  >
                    {checklist[item.key] ? <FaCheckSquare className="text-success" /> : <FaRegSquare className="text-muted" />}
                    <span className="small">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedProgramId && (
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div className="btn-group" role="group">
            <button
              className={`btn btn-sm ${statusFilter === "pending" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setStatusFilter("pending")}
            >
              Pending
            </button>
            <button
              className={`btn btn-sm ${statusFilter === "completed" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setStatusFilter("completed")}
            >
              Completed
            </button>
            <button
              className={`btn btn-sm ${statusFilter === "revision" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setStatusFilter("revision")}
            >
              Revision
            </button>
            <button
              className={`btn btn-sm ${statusFilter === "all" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
          </div>
          <input
            className="form-control"
            style={{ maxWidth: "420px" }}
            placeholder="Search by file, folder, QA status, category"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading && <div className="small text-muted mb-3">Loading QA submissions...</div>}

      {!loading && selectedProgramId && filteredSubmissions.length === 0 && (
        <div className="text-center py-5">
          <FaFileAlt className="text-muted mb-3" size={48} />
          <h5 className="text-muted">No documents found for QA compliance review.</h5>
        </div>
      )}

      {!loading && filteredSubmissions.length > 0 && view === "grid" && (
        <div className="row g-3">
          {filteredSubmissions.map((submission) => {
            const canAct = submission.qaStatus === "pending";
            return (
              <div key={submission._id} className="col-12 col-md-6 col-xl-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <div className="fw-semibold text-truncate" title={submission.originalName}>{submission.originalName}</div>
                        <div className="small text-muted">{submission.folderName}</div>
                      </div>
                      <span className={`badge ${normalizeQaStatusBadge(submission.qaStatus)}`}>
                        {submission.qaStatus}
                      </span>
                    </div>
                    <div className="small text-muted mb-2">
                      Uploaded: {submission.uploadDate ? new Date(submission.uploadDate).toLocaleString() : "N/A"} | {formatSize(submission.size)}
                    </div>
                    <textarea
                      className="form-control form-control-sm mb-2"
                      rows={2}
                      placeholder="QA notes (optional)"
                      value={reviewNotes[submission._id] || ""}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [submission._id]: e.target.value }))}
                    />
                    <div className="mb-2">
                      {renderTagControls(submission)}
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      <a
                        className="btn btn-sm btn-outline-primary"
                        href={`${BACKEND_URL}/preview/${submission.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FaEye className="me-1" /> Preview
                      </a>
                      <button
                        className="btn btn-sm btn-success"
                        disabled={!canAct || actingId === `${submission._id}-approve`}
                        onClick={() => handleReview(submission, "approve")}
                      >
                        <FaCheckCircle className="me-1" /> Approve
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={!canAct || actingId === `${submission._id}-reject`}
                        onClick={() => handleReview(submission, "reject")}
                      >
                        <FaTimesCircle className="me-1" /> Reject
                      </button>
                      <button
                        className="btn btn-sm btn-warning"
                        disabled={!canAct || actingId === `${submission._id}-request_missing_files`}
                        onClick={() => handleReview(submission, "request_missing_files")}
                      >
                        <FaUndo className="me-1" /> Request Missing Files
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredSubmissions.length > 0 && view === "list" && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Document</th>
                <th>Folder</th>
                <th>QA Status</th>
                <th>Uploaded</th>
                <th>QA Notes</th>
                <th>Compliance Tag</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((submission) => {
                const canAct = submission.qaStatus === "pending";
                return (
                  <tr key={submission._id}>
                    <td>
                      <div className="fw-semibold">{submission.originalName}</div>
                      <div className="small text-muted">{formatSize(submission.size)}</div>
                    </td>
                    <td className="small">{submission.folderName}</td>
                    <td>
                      <span className={`badge ${normalizeQaStatusBadge(submission.qaStatus)}`}>
                        {submission.qaStatus}
                      </span>
                    </td>
                    <td className="small">{submission.uploadDate ? new Date(submission.uploadDate).toLocaleString() : "N/A"}</td>
                    <td style={{ minWidth: "220px" }}>
                      <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        placeholder="QA notes (optional)"
                        value={reviewNotes[submission._id] || ""}
                        onChange={(e) => setReviewNotes((prev) => ({ ...prev, [submission._id]: e.target.value }))}
                      />
                    </td>
                    <td style={{ minWidth: "250px" }}>
                      {renderTagControls(submission)}
                    </td>
                    <td className="text-center">
                      <div className="d-flex flex-wrap gap-1 justify-content-center">
                        <a
                          className="btn btn-sm btn-outline-primary"
                          href={`${BACKEND_URL}/preview/${submission.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FaEye />
                        </a>
                        <button
                          className="btn btn-sm btn-success"
                          disabled={!canAct || actingId === `${submission._id}-approve`}
                          onClick={() => handleReview(submission, "approve")}
                        >
                          <FaCheckCircle />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={!canAct || actingId === `${submission._id}-reject`}
                          onClick={() => handleReview(submission, "reject")}
                        >
                          <FaTimesCircle />
                        </button>
                        <button
                          className="btn btn-sm btn-warning"
                          disabled={!canAct || actingId === `${submission._id}-request_missing_files`}
                          onClick={() => handleReview(submission, "request_missing_files")}
                        >
                          <FaUndo />
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
  );
}
