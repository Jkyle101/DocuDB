import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaDownload,
  FaEye,
  FaFileAlt,
  FaList,
  FaTh,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";

const REVIEW_AREAS = [
  "Verified documents",
  "Program compliance",
  "Faculty qualifications",
  "Facilities documentation",
];

export default function CopcEvaluationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [compilation, setCompilation] = useState({
    program: null,
    counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
    folders: [],
  });
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");

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

  const loadWorkflow = async (programId) => {
    if (!programId) {
      setWorkflow(null);
      return;
    }
    setLoadingWorkflow(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/workflow`, {
        params: { userId, role },
      });
      setWorkflow(data || null);
    } finally {
      setLoadingWorkflow(false);
    }
  };

  const loadCompilation = async (programId) => {
    if (!programId) {
      setCompilation({
        program: null,
        counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
        folders: [],
      });
      return;
    }
    setLoadingDocs(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/compilation/approved-tree`, {
        params: { userId, role },
      });
      setCompilation({
        program: data?.program || null,
        counts: data?.counts || { approvedFiles: 0, foldersWithApprovedFiles: 0 },
        folders: Array.isArray(data?.folders) ? data.folders : [],
      });
    } finally {
      setLoadingDocs(false);
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
    loadWorkflow(selectedProgramId).catch(() => setWorkflow(null));
    loadCompilation(selectedProgramId).catch(() =>
      setCompilation({
        program: null,
        counts: { approvedFiles: 0, foldersWithApprovedFiles: 0 },
        folders: [],
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  const documents = useMemo(() => {
    const rows = [];
    (compilation.folders || []).forEach((folder) => {
      (folder.files || []).forEach((file) => {
        rows.push({
          ...file,
          folderPath: folder.folderPath || "Root",
        });
      });
    });
    return rows;
  }, [compilation.folders]);

  const filteredDocuments = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => {
      const name = String(doc.originalName || "").toLowerCase();
      const folder = String(doc.folderPath || "").toLowerCase();
      return name.includes(q) || folder.includes(q);
    });
  }, [documents, query]);

  const downloadPackage = () => {
    if (!selectedProgramId) return;
    const url = `${BACKEND_URL}/copc/programs/${selectedProgramId}/package/download?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
    window.open(url, "_blank");
  };

  const downloadReport = () => {
    if (!selectedProgramId) return;
    const url = `${BACKEND_URL}/copc/programs/${selectedProgramId}/evaluation/report/download?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
    window.open(url, "_blank");
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
          <h4 className="mb-0">Evaluation Stage</h4>
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
            <button className={`btn ${view === "grid" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("grid")} title="Grid View">
              <FaTh />
            </button>
            <button className={`btn ${view === "list" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("list")} title="List View">
              <FaList />
            </button>
          </div>
        </div>
      </div>

      {!selectedProgramId && <div className="alert alert-info">Select a COPC program to start evaluator review.</div>}

      {selectedProgramId && (
        <div className="row g-3 mb-3">
          <div className="col-xl-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-light fw-semibold">Evaluator Review Scope</div>
              <div className="card-body">
                <ul className="mb-0">
                  {REVIEW_AREAS.map((item) => (
                    <li key={`scope-${item}`} className="small">{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="col-xl-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-light fw-semibold">Permissions and Restrictions</div>
              <div className="card-body">
                <div className="small"><strong>Allowed:</strong> View Documents, Download Reports, Review Compliance Dashboard</div>
                <div className="small text-danger mt-2"><strong>Restricted:</strong> No editing, no uploading, no deleting</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProgramId && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-light fw-semibold">Compliance Dashboard</div>
          <div className="card-body">
            {loadingWorkflow && <div className="small text-muted">Loading compliance dashboard...</div>}
            {!loadingWorkflow && workflow && (
              <>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                  <div>
                    <div className="fw-semibold">{workflow.program.code} - {workflow.program.name}</div>
                    <div className="small text-muted">{workflow.program.description || "No description"} | AY {workflow.program.year || "N/A"}</div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <span className="badge text-bg-light border">Overall Compliance: {Math.round(workflow.overallCompliance || 0)}%</span>
                    <span className="badge text-bg-light border">Approved Files: {compilation.counts.approvedFiles || 0}</span>
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-md-3"><div className="border rounded p-2 small">Submitted: <strong>{workflow.counts?.submitted || 0}</strong></div></div>
                  <div className="col-md-3"><div className="border rounded p-2 small">Pending Dept: <strong>{workflow.counts?.pendingProgramChair || 0}</strong></div></div>
                  <div className="col-md-3"><div className="border rounded p-2 small">Pending QA: <strong>{workflow.counts?.pendingQa || 0}</strong></div></div>
                  <div className="col-md-3"><div className="border rounded p-2 small">Rejected: <strong>{workflow.counts?.rejected || 0}</strong></div></div>
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <button className="btn btn-outline-dark" onClick={downloadPackage}>
                    <FaDownload className="me-1" /> Download COPC Package
                  </button>
                  <button className="btn btn-outline-primary" onClick={downloadReport}>
                    <FaDownload className="me-1" /> Download Compliance Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedProgramId && (
        <div className="card shadow-sm">
          <div className="card-header bg-light fw-semibold">Verified Documents</div>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <input
                className="form-control"
                style={{ maxWidth: "380px" }}
                placeholder="Search document or folder"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="badge text-bg-light border">Documents: {filteredDocuments.length}</span>
            </div>
            {loadingDocs && <div className="small text-muted">Loading verified documents...</div>}
            {!loadingDocs && filteredDocuments.length === 0 && (
              <div className="text-center py-4">
                <FaFileAlt className="text-muted mb-2" size={36} />
                <div className="small text-muted">No verified documents available yet.</div>
              </div>
            )}

            {!loadingDocs && filteredDocuments.length > 0 && view === "list" && (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Document</th>
                      <th>Folder</th>
                      <th>Uploaded</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => (
                      <tr key={`eval-doc-${doc._id}`}>
                        <td className="small fw-semibold">{doc.originalName}</td>
                        <td className="small">{doc.folderPath}</td>
                        <td className="small">{doc.uploadDate ? new Date(doc.uploadDate).toLocaleString() : "N/A"}</td>
                        <td className="text-center">
                          <div className="d-flex gap-1 justify-content-center">
                            <a
                              className="btn btn-sm btn-outline-primary"
                              href={`${BACKEND_URL}/preview/${doc.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FaEye />
                            </a>
                            <a
                              className="btn btn-sm btn-outline-success"
                              href={`${BACKEND_URL}/download/${doc.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                            >
                              <FaDownload />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loadingDocs && filteredDocuments.length > 0 && view === "grid" && (
              <div className="row g-3">
                {filteredDocuments.map((doc) => (
                  <div key={`eval-grid-${doc._id}`} className="col-12 col-md-6 col-xl-4">
                    <div className="card h-100 border">
                      <div className="card-body">
                        <div className="fw-semibold text-truncate" title={doc.originalName}>{doc.originalName}</div>
                        <div className="small text-muted text-truncate" title={doc.folderPath}>{doc.folderPath}</div>
                        <div className="small text-muted mb-2">
                          {doc.uploadDate ? new Date(doc.uploadDate).toLocaleString() : "N/A"}
                        </div>
                        <div className="d-flex gap-1">
                          <a
                            className="btn btn-sm btn-outline-primary"
                            href={`${BACKEND_URL}/preview/${doc.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FaEye className="me-1" /> View
                          </a>
                          <a
                            className="btn btn-sm btn-outline-success"
                            href={`${BACKEND_URL}/download/${doc.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                          >
                            <FaDownload className="me-1" /> Download
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
