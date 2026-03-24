import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaDownload,
  FaExternalLinkAlt,
  FaFileAlt,
  FaFolderOpen,
  FaSearch,
  FaTag,
  FaTimesCircle,
  FaUndo,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";
import "./copc-review-workspace.css";

const COMPLIANCE_CATEGORIES = [
  "Faculty Qualification Compliance",
  "Curriculum Alignment",
  "Facility Documentation",
  "Program Requirements",
  "Program Profile",
  "Administration",
  "Supporting Documents",
];

const statusToneClass = (status) => {
  if (status === "approved") return "status-approved";
  if (status === "rejected") return "status-rejected";
  return "status-pending";
};

export default function CopcQaReviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

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
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [loadingCompilation, setLoadingCompilation] = useState(false);
  const [runningCompile, setRunningCompile] = useState(false);
  const [compilationData, setCompilationData] = useState({
    program: null,
    counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
    folders: [],
  });

  const loadPrograms = async () => {
    const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, { params: { userId, role } });
    const list = Array.isArray(data) ? data : [];
    setPrograms(list);
    if (!list.length) {
      setSelectedProgramId("");
      return;
    }
    const queryProgramId = String(searchParams.get("programId") || "");
    const hasQueryProgram = queryProgramId && list.some((item) => String(item._id) === queryProgramId);
    setSelectedProgramId((prev) => {
      if (prev && list.some((item) => String(item._id) === String(prev))) return prev;
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

  useEffect(() => {
    if (!filteredSubmissions.length) {
      setSelectedSubmissionId("");
      return;
    }
    if (!filteredSubmissions.some((item) => String(item._id) === String(selectedSubmissionId))) {
      setSelectedSubmissionId(String(filteredSubmissions[0]._id));
    }
  }, [filteredSubmissions, selectedSubmissionId]);

  const selectedSubmission = useMemo(
    () => filteredSubmissions.find((item) => String(item._id) === String(selectedSubmissionId)) || null,
    [filteredSubmissions, selectedSubmissionId]
  );

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

  const goBackToDashboard = () => {
    const params = new URLSearchParams({ tab: "workflow" });
    if (selectedProgramId) params.set("programId", String(selectedProgramId));
    navigate(`/copc-dashboard?${params.toString()}`);
  };

  const previewUrl = selectedSubmission
    ? `${BACKEND_URL}/preview/${selectedSubmission.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`
    : "";
  const downloadUrl = selectedSubmission
    ? `${BACKEND_URL}/download/${selectedSubmission.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`
    : "";
  const canAct = selectedSubmission?.qaStatus === "pending";
  const tagDraft = selectedSubmission ? tagDrafts[selectedSubmission._id] || {} : {};
  const categoryValue = selectedSubmission
    ? tagDraft.category ?? selectedSubmission.classification?.category ?? ""
    : "";
  const tagsValue = selectedSubmission
    ? tagDraft.tags ?? (selectedSubmission.classification?.tags || []).join(", ")
    : "";

  return (
    <div className="container-fluid py-3 file-manager-container">
      <div className="copc-review-shell">
        <div className="copc-review-page-header">
          <div className="copc-review-heading">
            <button className="btn btn-outline-secondary" onClick={goBackToDashboard}>
              <FaArrowLeft className="me-1" /> Back
            </button>
            <div>
              <div className="copc-review-kicker">Explorer / QA Compliance</div>
              <h4 className="mb-0">QA File Review</h4>
            </div>
          </div>
          <select
            className="form-select copc-review-program-select"
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
        </div>

        {!selectedProgramId && (
          <div className="alert alert-info mb-0">Select a COPC program to start QA compliance review.</div>
        )}

        {selectedProgramId && programMeta && (
          <div className="copc-review-program-card">
            <div>
              <div className="copc-review-program-title">{programMeta.code} - {programMeta.name}</div>
              <div className="copc-review-program-subtitle">
                {programMeta.description || "No description"} | AY {programMeta.year || "N/A"}
              </div>
            </div>
            <div className="copc-review-counts">
              <span className="copc-review-count-pill">Pending: {overallCounts.pending}</span>
              <span className="copc-review-count-pill">Approved: {overallCounts.approved}</span>
              <span className="copc-review-count-pill">Rejected: {overallCounts.rejected}</span>
            </div>
          </div>
        )}

        {selectedProgramId && (
          <div className="copc-review-compilation-card">
            <div className="copc-review-compilation-head">
              <div>
                <div className="copc-review-program-title mb-1">COPC Compilation Stage</div>
                <div className="copc-review-program-subtitle">
                  Compile and download verified documents once QA approvals are complete.
                </div>
              </div>
              <div className="copc-review-compilation-actions">
                <button className="btn btn-primary" onClick={runCompile} disabled={runningCompile || !selectedProgramId}>
                  <FaFolderOpen className="me-1" />
                  {runningCompile ? "Generating..." : "Generate COPC Package"}
                </button>
                <button className="btn btn-outline-dark" onClick={downloadPackage} disabled={!selectedProgramId}>
                  <FaDownload className="me-1" />
                  Download Package
                </button>
              </div>
            </div>
            <div className="copc-review-compilation-meta">
              <span className="copc-review-count-pill">Approved Files: {compilationData.counts.approvedFiles || 0}</span>
              <span className="copc-review-count-pill">Folders: {compilationData.counts.foldersWithApprovedFiles || 0}</span>
            </div>
            {loadingCompilation && <div className="small text-muted">Loading approved folder structure...</div>}
            {!loadingCompilation && Array.isArray(compilationData.folders) && compilationData.folders.length > 0 && (
              <div className="copc-review-compilation-list">
                {compilationData.folders.map((folder) => (
                  <details key={`compile-${folder.folderPath || "root"}`} className="copc-review-compilation-folder">
                    <summary>{folder.folderPath || "Root"}</summary>
                    <div className="copc-review-compilation-files">
                      {(folder.files || []).map((file) => (
                        <a
                          key={`compile-file-${file._id}`}
                          href={`${BACKEND_URL}/preview/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {file.originalName}
                        </a>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedProgramId && (
          <div className="copc-review-filter-row">
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
            <div className="copc-review-search">
              <FaSearch />
              <input
                className="form-control"
                placeholder="Search by file, folder, category, or status"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading && <div className="small text-muted">Loading QA submissions...</div>}

        {!loading && selectedProgramId && filteredSubmissions.length === 0 && (
          <div className="copc-review-empty">
            <FaFileAlt size={44} />
            <h5>No documents found for QA compliance review.</h5>
          </div>
        )}

        {!loading && filteredSubmissions.length > 0 && selectedSubmission && (
          <div className="copc-review-layout">
            <section className="copc-review-main-pane">
              <div className="copc-review-breadcrumb">
                EXPLORER &gt; {String(programMeta?.code || "COPC").toUpperCase()} &gt;{" "}
                {String(selectedSubmission.originalName || "").toUpperCase()}
              </div>
              <div className="copc-review-document-title-row">
                <h3>{selectedSubmission.originalName}</h3>
                <span className={`copc-review-status-pill ${statusToneClass(selectedSubmission.qaStatus)}`}>
                  {selectedSubmission.qaStatus === "pending" ? "UNDER REVIEW" : selectedSubmission.qaStatus.toUpperCase()}
                </span>
              </div>

              <div className="copc-review-doc-strip">
                {filteredSubmissions.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`copc-review-doc-chip ${String(selectedSubmissionId) === String(item._id) ? "is-active" : ""}`}
                    onClick={() => setSelectedSubmissionId(String(item._id))}
                  >
                    <span className="copc-review-doc-chip-name">{item.originalName}</span>
                    <span className={`copc-review-doc-chip-status ${statusToneClass(item.qaStatus)}`}>
                      {item.qaStatus}
                    </span>
                  </button>
                ))}
              </div>

              <div className="copc-review-viewer-card">
                <div className="copc-review-viewer-toolbar">
                  <div className="copc-review-file-name">
                    <FaFileAlt />
                    <span>{selectedSubmission.originalName}</span>
                  </div>
                  <div className="copc-review-viewer-actions">
                    <span>100%</span>
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Download file"
                      aria-label="Download file"
                    >
                      <FaDownload />
                    </a>
                    <a href={previewUrl} target="_blank" rel="noreferrer" title="Open preview in new tab">
                      <FaExternalLinkAlt />
                    </a>
                  </div>
                </div>
                <div className="copc-review-viewer-frame">
                  <iframe title={`Preview ${selectedSubmission.originalName}`} src={previewUrl} />
                </div>
              </div>
            </section>

            <aside className="copc-review-side-pane">
              <div className="copc-review-verdict-card">
                <h5>Review Verdict</h5>
                <button
                  className="btn btn-primary"
                  disabled={!canAct || actingId === `${selectedSubmission._id}-approve`}
                  onClick={() => handleReview(selectedSubmission, "approve")}
                >
                  <FaCheckCircle className="me-2" />
                  Approve Document
                </button>
                <button
                  className="btn btn-outline-warning"
                  disabled={!canAct || actingId === `${selectedSubmission._id}-request_missing_files`}
                  onClick={() => handleReview(selectedSubmission, "request_missing_files")}
                >
                  <FaUndo className="me-2" />
                  Request Missing Files
                </button>
                <button
                  className="btn btn-outline-danger"
                  disabled={!canAct || actingId === `${selectedSubmission._id}-reject`}
                  onClick={() => handleReview(selectedSubmission, "reject")}
                >
                  <FaTimesCircle className="me-2" />
                  Reject
                </button>
                <a
                  className="btn btn-outline-secondary"
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaDownload className="me-2" />
                  Download File
                </a>

                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="QA notes (included when you submit verdict)"
                  value={reviewNotes[selectedSubmission._id] || ""}
                  onChange={(e) => setReviewNotes((prev) => ({ ...prev, [selectedSubmission._id]: e.target.value }))}
                />

                <div className="copc-review-tag-box">
                  <div className="copc-review-tag-head">
                    <FaTag />
                    Compliance Tagging
                  </div>
                  <select
                    className="form-select form-select-sm"
                    value={categoryValue}
                    onChange={(e) => setDraft(selectedSubmission._id, "category", e.target.value)}
                  >
                    <option value="">Select Compliance Category</option>
                    {COMPLIANCE_CATEGORIES.map((item) => (
                      <option key={`${selectedSubmission._id}-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Tags (comma-separated)"
                    value={tagsValue}
                    onChange={(e) => setDraft(selectedSubmission._id, "tags", e.target.value)}
                  />
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={actingId === `${selectedSubmission._id}-tag`}
                    onClick={() => handleTagCategory(selectedSubmission)}
                  >
                    Save Category & Tags
                  </button>
                </div>
              </div>

            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
