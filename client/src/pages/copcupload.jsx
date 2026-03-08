import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaArrowLeft,
  FaCheckSquare,
  FaChevronDown,
  FaChevronRight,
  FaChevronUp,
  FaCloudDownloadAlt,
  FaEye,
  FaFolder,
  FaList,
  FaRegSquare,
  FaTh,
  FaUpload,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";
import UploadModal from "../components/UploadModal";

const workflowStatusMeta = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return { label: "Approved", className: "bg-success" };
  if (key === "pending_program_chair") return { label: "Pending Dept Chair", className: "bg-warning text-dark" };
  if (key === "pending_qa") return { label: "Pending QA", className: "bg-primary" };
  if (key === "rejected_program_chair") return { label: "Needs Revision (Dept Chair)", className: "bg-danger" };
  if (key === "rejected_qa") return { label: "Needs Revision (QA)", className: "bg-danger" };
  return { label: "In Review", className: "bg-secondary" };
};

const reviewerStatusMeta = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return { label: "Approved", className: "text-success" };
  if (key === "rejected") return { label: "Rejected", className: "text-danger" };
  if (key === "pending") return { label: "Pending", className: "text-warning" };
  if (key === "not_required") return { label: "Not Required", className: "text-muted" };
  return { label: "N/A", className: "text-muted" };
};

const isFullyApproved = (file) => {
  const workflow = file?.reviewWorkflow || {};
  return (
    String(workflow?.status || "") === "approved" &&
    String(workflow?.programChair?.status || "") === "approved" &&
    String(workflow?.qaOfficer?.status || "") === "approved"
  );
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

export default function CopcUploadPage() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "faculty";

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programMeta, setProgramMeta] = useState(null);
  const [folders, setFolders] = useState([]);
  const [view, setView] = useState("grid");
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderQuery, setFolderQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklistSections, setChecklistSections] = useState([]);
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(true);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [loadingFolderFiles, setLoadingFolderFiles] = useState(false);
  const [approvedFilesInFolder, setApprovedFilesInFolder] = useState([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusSearch, setStatusSearch] = useState("");
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [uploadStatusCounts, setUploadStatusCounts] = useState({
    total: 0,
    approved: 0,
    pendingProgramChair: 0,
    pendingQa: 0,
    rejectedProgramChair: 0,
    rejectedQa: 0,
  });

  const buildFolderMap = (list = []) => {
    const map = new Map();
    (list || []).forEach((f) => map.set(String(f._id), f));
    return map;
  };

  const buildFolderPath = (folder, map, rootId) => {
    const parts = [];
    let cursor = folder;
    let guard = 0;
    while (cursor && guard < 100) {
      guard += 1;
      const id = String(cursor._id);
      if (id === String(rootId)) break;
      parts.unshift(cursor.name);
      const parentId = cursor.parentFolder ? String(cursor.parentFolder) : "";
      if (!parentId) break;
      cursor = map.get(parentId);
    }
    return parts.join(" / ");
  };

  const flattenTasks = (tasks = [], depth = 0, output = []) => {
    (tasks || []).forEach((task) => {
      output.push({
        _id: task?._id || `${task?.title || "task"}-${depth}`,
        title: task?.title || "Untitled Task",
        status: task?.status || "not_started",
        percentage: Number(task?.percentage || 0),
        depth,
      });
      flattenTasks(task?.children || [], depth + 1, output);
    });
    return output;
  };

  const folderMap = useMemo(() => buildFolderMap(folders), [folders]);

  const currentFolder = useMemo(
    () => folders.find((f) => String(f._id) === String(currentFolderId)) || null,
    [folders, currentFolderId]
  );

  const breadcrumbs = useMemo(() => {
    if (!currentFolderId) return [];
    const trail = [];
    let cursor = folderMap.get(String(currentFolderId));
    let guard = 0;
    while (cursor && guard < 100) {
      guard += 1;
      trail.unshift(cursor);
      const parentId = cursor.parentFolder ? String(cursor.parentFolder) : "";
      if (!parentId || !folderMap.has(parentId)) break;
      cursor = folderMap.get(parentId);
    }
    return trail;
  }, [currentFolderId, folderMap]);

  const visibleFolders = useMemo(() => {
    const list = Array.isArray(folders) ? folders : [];
    const sorted = [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (!currentFolderId) {
      return sorted.filter((f) => {
        const parentId = f.parentFolder ? String(f.parentFolder) : "";
        return !parentId || !folderMap.has(parentId);
      });
    }
    return sorted.filter((f) => String(f.parentFolder || "") === String(currentFolderId));
  }, [folders, currentFolderId, folderMap]);

  const filteredFolders = useMemo(() => {
    const query = String(folderQuery || "").trim().toLowerCase();
    if (!query) return visibleFolders;
    return visibleFolders.filter((folder) => {
      const name = String(folder.name || "").toLowerCase();
      const path = String(folder.path || "").toLowerCase();
      return name.includes(query) || path.includes(query);
    });
  }, [visibleFolders, folderQuery]);

  const statusScopedFolderId = useMemo(() => {
    if (!currentFolderId) return "";
    const found = folders.some((folder) => String(folder._id) === String(currentFolderId));
    return found ? String(currentFolderId) : "";
  }, [currentFolderId, folders]);

  const filteredUploadStatuses = useMemo(() => {
    const q = String(statusSearch || "").trim().toLowerCase();
    if (!q) return uploadStatuses;
    return uploadStatuses.filter((item) => {
      const name = String(item.originalName || "").toLowerCase();
      const folderName = String(item.folderName || "").toLowerCase();
      const workflow = String(item.workflowStatus || "").toLowerCase();
      return name.includes(q) || folderName.includes(q) || workflow.includes(q);
    });
  }, [uploadStatuses, statusSearch]);

  const checklistStats = useMemo(() => {
    const tasks = checklistSections.flatMap((section) => section.tasks || []);
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "complete" || Number(task.percentage || 0) >= 100).length;
    return { total, completed };
  }, [checklistSections]);

  const goUp = () => {
    if (!currentFolderId) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    setCurrentFolderId(parent ? parent._id : null);
  };

  const loadPrograms = async () => {
    const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, {
      params: { userId, role },
    });
    const list = Array.isArray(data) ? data : [];
    setPrograms(list);
    if (!selectedProgramId && list.length > 0) {
      setSelectedProgramId(String(list[0]._id));
    }
  };

  const loadApprovedFilesInFolder = async (folderId) => {
    if (!folderId) {
      setApprovedFilesInFolder([]);
      return;
    }
    setLoadingFolderFiles(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/files`, {
        params: {
          userId,
          role,
          parentFolder: folderId,
          sortBy: "date",
          sortOrder: "desc",
        },
      });
      const list = Array.isArray(data) ? data : [];
      setApprovedFilesInFolder(list.filter((file) => isFullyApproved(file)));
    } catch {
      setApprovedFilesInFolder([]);
    } finally {
      setLoadingFolderFiles(false);
    }
  };

  const loadUploadStatuses = async (programId, folderId = "", nextStatus = statusFilter) => {
    if (!programId || !userId) {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
      return;
    }
    setLoadingStatuses(true);
    try {
      const params = {
        userId,
        role,
        status: nextStatus || "all",
      };
      if (folderId) params.folderId = folderId;
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/my-upload-status`, {
        params,
      });
      setUploadStatuses(Array.isArray(data?.files) ? data.files : []);
      setUploadStatusCounts(
        data?.counts || {
          total: 0,
          approved: 0,
          pendingProgramChair: 0,
          pendingQa: 0,
          rejectedProgramChair: 0,
          rejectedQa: 0,
        }
      );
    } catch {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
    } finally {
      setLoadingStatuses(false);
    }
  };

  const loadProgramFolders = async (programId, preserveCurrentFolder = false) => {
    if (!programId) {
      setProgramMeta(null);
      setFolders([]);
      setChecklistSections([]);
      setCurrentFolderId(null);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/copc/programs/${programId}/folders`, {
        params: { userId, role },
      });
      setProgramMeta(data?.program || null);

      const allFolders = Array.isArray(data?.folders) ? data.folders : [];
      const allMap = buildFolderMap(allFolders);
      const uploadable = allFolders
        .filter((f) => !!f.canUpload && !f.isProgramRoot)
        .map((f) => ({
          ...f,
          path: buildFolderPath(f, allMap, data?.program?._id || programId),
        }));

      const uploadableIds = new Set(uploadable.map((f) => String(f._id)));
      setFolders(uploadable);
      setCurrentFolderId((prev) => {
        if (!preserveCurrentFolder || !prev) return null;
        return uploadableIds.has(String(prev)) ? prev : null;
      });

      setLoadingChecklist(true);
      try {
        const checklistRows = await Promise.all(
          uploadable.map(async (folder) => {
            if (!folder.taskCount) return { folder, tasks: [] };
            const taskRes = await axios.get(`${BACKEND_URL}/folders/${folder._id}/tasks`, {
              params: { userId, role },
            });
            const normalizedTasks = Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : [];
            return {
              folder,
              tasks: flattenTasks(normalizedTasks),
            };
          })
        );
        setChecklistSections(checklistRows.filter((row) => row.tasks.length > 0));
      } catch {
        setChecklistSections([]);
      } finally {
        setLoadingChecklist(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms().catch(() => setPrograms([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProgramId) return;
    setFolderQuery("");
    loadProgramFolders(selectedProgramId, false).catch(() => {
      setProgramMeta(null);
      setFolders([]);
      setChecklistSections([]);
      setCurrentFolderId(null);
    });
    loadUploadStatuses(selectedProgramId, "", statusFilter).catch(() => {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  useEffect(() => {
    if (!selectedProgramId) return;
    loadUploadStatuses(selectedProgramId, statusScopedFolderId, statusFilter).catch(() => {
      setUploadStatuses([]);
      setUploadStatusCounts({
        total: 0,
        approved: 0,
        pendingProgramChair: 0,
        pendingQa: 0,
        rejectedProgramChair: 0,
        rejectedQa: 0,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, statusScopedFolderId, statusFilter]);

  useEffect(() => {
    loadApprovedFilesInFolder(currentFolderId).catch(() => setApprovedFilesInFolder([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, selectedProgramId]);

  return (
    <div className="container-fluid py-3 file-manager-container">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {currentFolderId && (
            <button className="btn btn-outline-secondary" onClick={goUp}>
              <FaArrowLeft className="me-1" /> Back
            </button>
          )}
          <div className="d-flex align-items-center flex-wrap overflow-auto">
            <span className="fw-bold me-2 text-primary">COPC Upload Workspace</span>
            {breadcrumbs.map((b) => (
              <span key={b._id || "root"} className="d-flex align-items-center">
                <FaChevronRight className="mx-2 text-muted" size={12} />
                <button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => setCurrentFolderId(b._id)}>
                  {b.name}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
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
          <button
            className="btn btn-success"
            disabled={!currentFolder}
            title={currentFolder ? `Upload to ${currentFolder.name}` : "Open a folder first"}
            onClick={() => currentFolder && setUploadTarget(currentFolder)}
          >
            <FaUpload className="me-1" /> Upload
          </button>
        </div>
      </div>

      {!selectedProgramId && <div className="alert alert-info">Select a COPC program to upload documents.</div>}

      {selectedProgramId && (
        <div className="alert alert-light border py-2 px-3 small mb-3">
          Step 1: select a program. Step 2: open a folder. Step 3: click upload.
        </div>
      )}

      {selectedProgramId && programMeta && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="fw-semibold">{programMeta.code} - {programMeta.name}</div>
            <div className="small text-muted">
              AY {programMeta.year || "N/A"} | {programMeta.isLocked ? "Locked after final approval" : "Open for upload based on assignment"}
            </div>
            <div className="small mt-1">
              <span className="badge text-bg-light border me-2">Folders: {folders.length}</span>
              <span className="badge text-bg-light border">Current: {currentFolder?.name || "Root"}</span>
            </div>
          </div>
        </div>
      )}

      {selectedProgramId && currentFolder && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="fw-semibold small">Approved Files in Folder: {currentFolder.name}</div>
            <span className="badge text-bg-light border">Approved: {approvedFilesInFolder.length}</span>
          </div>
          <div className="card-body py-2">
            {loadingFolderFiles && <div className="small text-muted">Loading approved files...</div>}
            {!loadingFolderFiles && approvedFilesInFolder.length === 0 && (
              <div className="small text-muted">
                No fully approved files in this folder yet. Files appear here after Dept Chair and QA approval.
              </div>
            )}
            {!loadingFolderFiles && approvedFilesInFolder.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>File</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedFilesInFolder.map((file) => (
                      <tr key={`approved-folder-file-${file._id}`}>
                        <td className="small fw-semibold">{file.originalName}</td>
                        <td className="small">{formatFileSize(file.size)}</td>
                        <td className="small">{file.uploadDate ? new Date(file.uploadDate).toLocaleString() : "N/A"}</td>
                        <td className="text-center">
                          <div className="d-flex gap-1 justify-content-center">
                            <a
                              className="btn btn-sm btn-outline-primary"
                              href={`${BACKEND_URL}/preview/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Preview"
                            >
                              <FaEye />
                            </a>
                            <a
                              className="btn btn-sm btn-outline-success"
                              href={`${BACKEND_URL}/download/${file.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                              title="Download"
                            >
                              <FaCloudDownloadAlt />
                            </a>
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
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="fw-semibold small">
              My Uploaded Files Status {currentFolder ? `- ${currentFolder.name}` : "(Program Scope)"}
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <span className="badge text-bg-light border">Total: {uploadStatusCounts.total}</span>
              <span className="badge text-bg-light border">Approved: {uploadStatusCounts.approved}</span>
              <span className="badge text-bg-light border">Pending Dept Chair: {uploadStatusCounts.pendingProgramChair}</span>
              <span className="badge text-bg-light border">Pending QA: {uploadStatusCounts.pendingQa}</span>
              <span className="badge text-bg-light border text-danger">Revisions: {uploadStatusCounts.rejectedProgramChair + uploadStatusCounts.rejectedQa}</span>
            </div>
          </div>
          <div className="card-body py-2">
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: "240px" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending_program_chair">Pending Dept Chair</option>
                <option value="pending_qa">Pending QA</option>
                <option value="approved">Approved</option>
                <option value="rejected_program_chair">Needs Revision (Dept Chair)</option>
                <option value="rejected_qa">Needs Revision (QA)</option>
              </select>
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: "360px" }}
                placeholder="Search uploaded file"
                value={statusSearch}
                onChange={(e) => setStatusSearch(e.target.value)}
              />
            </div>
            {loadingStatuses && <div className="small text-muted">Loading upload status...</div>}
            {!loadingStatuses && filteredUploadStatuses.length === 0 && (
              <div className="small text-muted">
                No uploaded files found in this scope yet.
              </div>
            )}
            {!loadingStatuses && filteredUploadStatuses.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>File</th>
                      <th>Folder</th>
                      <th>Uploaded</th>
                      <th>Status</th>
                      <th>Dept Chair</th>
                      <th>QA</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUploadStatuses.slice(0, 25).map((item) => {
                      const workflow = workflowStatusMeta(item.workflowStatus);
                      const chair = reviewerStatusMeta(item.programChairStatus);
                      const qa = reviewerStatusMeta(item.qaStatus);
                      const revisionNote = String(item.programChairNotes || item.qaNotes || "").trim();
                      return (
                        <tr key={`upload-status-${item._id}`}>
                          <td>
                            <div className="fw-semibold text-truncate" style={{ maxWidth: "260px" }} title={item.originalName}>
                              {item.originalName}
                            </div>
                            <div className="small text-muted">{formatFileSize(item.size)}</div>
                            {revisionNote && (
                              <div className="small text-danger text-truncate" style={{ maxWidth: "260px" }} title={revisionNote}>
                                Note: {revisionNote}
                              </div>
                            )}
                          </td>
                          <td className="small">{item.folderName}</td>
                          <td className="small">
                            {item.uploadDate ? new Date(item.uploadDate).toLocaleString() : "N/A"}
                          </td>
                          <td>
                            <span className={`badge ${workflow.className}`}>{workflow.label}</span>
                          </td>
                          <td className={`small fw-semibold ${chair.className}`}>{chair.label}</td>
                          <td className={`small fw-semibold ${qa.className}`}>{qa.label}</td>
                          <td className="text-center">
                            <a
                              className="btn btn-sm btn-outline-primary"
                              href={`${BACKEND_URL}/preview/${item.filename}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Preview file"
                            >
                              <FaEye />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loadingStatuses && filteredUploadStatuses.length > 25 && (
              <div className="small text-muted mt-2">
                Showing first 25 results. Use search/filter to narrow down.
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <div className="small text-muted mb-3">Loading COPC folders...</div>}

      {!loading && selectedProgramId && (
        <div className="card shadow-sm mb-3" style={{ maxWidth: "460px" }}>
          <div className="card-header bg-light py-2">
            <div className="d-flex justify-content-between align-items-center">
              <div className="fw-semibold small">Task Checklist</div>
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">{checklistStats.completed}/{checklistStats.total}</span>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setIsChecklistCollapsed((v) => !v)}
                  title={isChecklistCollapsed ? "Expand checklist" : "Collapse checklist"}
                >
                  {isChecklistCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                </button>
              </div>
            </div>
          </div>
          {!isChecklistCollapsed && (
            <div className="card-body py-2" style={{ maxHeight: "240px", overflowY: "auto" }}>
              {loadingChecklist && <div className="small text-muted">Loading checklist...</div>}
              {!loadingChecklist && checklistSections.length === 0 && (
                <div className="small text-muted">No checklist tasks found for your assigned upload folders.</div>
              )}
              {!loadingChecklist && checklistSections.length > 0 && (
                <div className="d-flex flex-column gap-2">
                  {checklistSections.map((section) => (
                    <div key={`chk-${section.folder._id}`}>
                      <div className="small fw-semibold mb-1">{section.folder.name}</div>
                      <div className="d-flex flex-column gap-1">
                        {section.tasks.map((task) => (
                          <div key={`tsk-${section.folder._id}-${task._id}-${task.depth}`} className="d-flex align-items-center gap-2 small">
                            <span style={{ width: `${task.depth * 12}px` }} />
                            {task.status === "complete" ? (
                              <FaCheckSquare className="text-success" />
                            ) : (
                              <FaRegSquare className="text-muted" />
                            )}
                            <span className={task.status === "complete" ? "text-success" : ""}>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && selectedProgramId && (
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <input
            className="form-control"
            style={{ maxWidth: "380px" }}
            placeholder="Search folder name/path"
            value={folderQuery}
            onChange={(e) => setFolderQuery(e.target.value)}
          />
          {currentFolderId && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setCurrentFolderId(null)}>
              Go to Root
            </button>
          )}
        </div>
      )}

      {!loading && selectedProgramId && filteredFolders.length === 0 && (
        <div className="text-center py-5">
          <FaFolder className="text-muted mb-3" size={48} />
          <h5 className="text-muted">
            {folderQuery ? "No folders match your search" : "No assigned upload folders in this scope"}
          </h5>
        </div>
      )}

      {!loading && filteredFolders.length > 0 && view === "grid" && (
        <div className="row g-4">
          {filteredFolders.map((folder) => (
            <div key={folder._id} className="col-6 col-sm-4 col-md-3 col-xl-2">
              <div className="card folder-card h-100 text-center p-3 position-relative">
                <FaFolder size={42} className="text-warning mb-3" />
                <h6 className="card-title text-truncate" title={folder.path || folder.name}>{folder.name}</h6>
                <p className="text-muted small text-truncate" title={folder.path || folder.name}>{folder.path || folder.name}</p>
                <div className="d-flex gap-1 justify-content-center mt-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => setCurrentFolderId(folder._id)} title="Open folder">
                    <FaEye className="me-1" /> Open
                  </button>
                  <button className="btn btn-sm btn-outline-success" onClick={() => setUploadTarget(folder)} title="Upload here">
                    <FaUpload className="me-1" /> Upload
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredFolders.length > 0 && view === "list" && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Tasks</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFolders.map((folder) => (
                <tr key={folder._id}>
                  <td className="d-flex align-items-center">
                    <FaFolder className="text-warning me-2" />
                    {folder.name}
                  </td>
                  <td className="small text-muted">{folder.path || folder.name}</td>
                  <td>{folder.taskCount || 0}</td>
                  <td className="text-center">
                    <div className="btn-group">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setCurrentFolderId(folder._id)}>
                        <FaEye className="me-1" /> Open
                      </button>
                      <button className="btn btn-sm btn-outline-success" onClick={() => setUploadTarget(folder)}>
                        <FaUpload className="me-1" /> Upload
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadTarget && (
        <>
          <div className="modal-backdrop fade show"></div>
          <UploadModal
            onClose={() => setUploadTarget(null)}
            onUploaded={() => {
              loadProgramFolders(selectedProgramId, true).catch(() => {});
              loadUploadStatuses(selectedProgramId, statusScopedFolderId, statusFilter).catch(() => {});
              loadApprovedFilesInFolder(statusScopedFolderId || currentFolderId).catch(() => {});
            }}
            parentFolder={uploadTarget._id}
            hideDestinationFolder
          />
        </>
      )}
    </div>
  );
}
