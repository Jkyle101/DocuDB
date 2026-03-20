import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaDownload,
  FaExternalLinkAlt,
  FaFileAlt,
  FaSearch,
  FaTimesCircle,
  FaUndo,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";
import "./copc-review-workspace.css";

const statusToneClass = (status) => {
  if (status === "approved") return "status-approved";
  if (status === "rejected") return "status-rejected";
  return "status-pending";
};

export default function CopcDepartmentReviewPage() {
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
  const [query, setQuery] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");

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
        axios.get(`${BACKEND_URL}/copc/programs/${programId}/department-chair/submissions`, {
          params: { userId, role, status: nextFilter },
        }),
        axios.get(`${BACKEND_URL}/copc/programs/${programId}/department-chair/submissions`, {
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

  const filteredSubmissions = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((item) => {
      const name = String(item.originalName || "").toLowerCase();
      const folder = String(item.folderName || "").toLowerCase();
      const category = String(item.classification?.category || item.classification || "").toLowerCase();
      const status = String(item.programChairStatus || "").toLowerCase();
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

  const handleReview = async (submission, action) => {
    if (!submission?._id) return;
    let normalizedAction = action;
    let notes = String(reviewNotes[submission._id] || "").trim();

    if (action === "request_revision") {
      normalizedAction = "reject";
      notes = notes ? `Revision requested: ${notes}` : "Revision requested by Department Chair.";
    }

    if (action === "reject" && !notes) {
      const promptValue = window.prompt("Add rejection note (optional):", "");
      if (promptValue === null) return;
      notes = String(promptValue || "").trim();
    }

    setActingId(`${submission._id}-${action}`);
    try {
      await axios.patch(`${BACKEND_URL}/files/${submission._id}/review/program-chair`, {
        userId,
        role,
        action: normalizedAction,
        notes,
      });
      setReviewNotes((prev) => ({ ...prev, [submission._id]: "" }));
      await loadSubmissions(selectedProgramId, statusFilter);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to process review action");
    } finally {
      setActingId("");
    }
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
  const canAct = selectedSubmission?.programChairStatus === "pending";

  return (
    <div className="container-fluid py-3 file-manager-container">
      <div className="copc-review-shell">
        <div className="copc-review-page-header">
          <div className="copc-review-heading">
            <button className="btn btn-outline-secondary" onClick={goBackToDashboard}>
              <FaArrowLeft className="me-1" /> Back
            </button>
            <div>
              <div className="copc-review-kicker">Explorer / Department Review</div>
              <h4 className="mb-0">Department Chair File Review</h4>
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
          <div className="alert alert-info mb-0">Select a COPC program to review faculty submissions.</div>
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

        {loading && <div className="small text-muted">Loading submissions...</div>}

        {!loading && selectedProgramId && filteredSubmissions.length === 0 && (
          <div className="copc-review-empty">
            <FaFileAlt size={44} />
            <h5>No faculty submissions found in this view.</h5>
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
                <span className={`copc-review-status-pill ${statusToneClass(selectedSubmission.programChairStatus)}`}>
                  {selectedSubmission.programChairStatus === "pending" ? "UNDER REVIEW" : selectedSubmission.programChairStatus.toUpperCase()}
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
                    <span className={`copc-review-doc-chip-status ${statusToneClass(item.programChairStatus)}`}>
                      {item.programChairStatus}
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
                  disabled={!canAct || actingId === `${selectedSubmission._id}-request_revision`}
                  onClick={() => handleReview(selectedSubmission, "request_revision")}
                >
                  <FaUndo className="me-2" />
                  Request Revisions
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
                  placeholder="Review notes (included when you submit verdict)"
                  value={reviewNotes[selectedSubmission._id] || ""}
                  onChange={(e) => setReviewNotes((prev) => ({ ...prev, [selectedSubmission._id]: e.target.value }))}
                />
              </div>

            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
