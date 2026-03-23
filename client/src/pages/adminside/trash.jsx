import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaTh,
  FaList,
  FaFolder,
  FaFileAlt,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
  FaTrashRestore,
  FaTimes,
  FaCheckSquare,
  FaSquare,
  FaTrash,
  FaUser,
  FaSearch,
  FaClock,
  FaShieldAlt,
} from "react-icons/fa";
import { BACKEND_URL } from "../../config";
import "./trash.css";

function formatFileSize(bytes) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDeletedLabel(value) {
  if (!value) return "Deleted date unavailable";
  const deletedAt = new Date(value);
  if (Number.isNaN(deletedAt.getTime())) return "Deleted date unavailable";
  const diffMs = Math.max(0, Date.now() - deletedAt.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 1) return `Deleted ${days} day${days === 1 ? "" : "s"} ago`;
  if (hours >= 1) return `Deleted ${hours} hour${hours === 1 ? "" : "s"} ago`;
  return "Deleted just now";
}

export default function AdminTrash() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "superadmin";

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [view, setView] = useState("grid");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTrash = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/trash`, {
        params: { userId, role },
      });
      setFiles(res.data.files || []);
      setFolders(res.data.folders || []);
    } catch (err) {
      console.error("Failed to fetch trash:", err);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const iconByMime = useMemo(
    () => (mimetype) => {
      if (!mimetype) return <FaFileAlt className="trash-file-icon text-secondary" />;
      if (mimetype.includes("pdf")) return <FaFilePdf className="trash-file-icon text-danger" />;
      if (mimetype.includes("word") || mimetype.includes("doc")) {
        return <FaFileWord className="trash-file-icon text-primary" />;
      }
      if (mimetype.includes("excel") || mimetype.includes("spreadsheet")) {
        return <FaFileExcel className="trash-file-icon text-success" />;
      }
      if (mimetype.includes("image")) return <FaFileImage className="trash-file-icon text-warning" />;
      if (mimetype.includes("zip") || mimetype.includes("rar")) {
        return <FaFileArchive className="trash-file-icon text-muted" />;
      }
      if (mimetype.includes("video")) return <FaFileVideo className="trash-file-icon text-info" />;
      return <FaFileAlt className="trash-file-icon text-secondary" />;
    },
    []
  );

  const restoreItem = async (type, id) => {
    try {
      await axios.patch(`${BACKEND_URL}/trash/${type}/${id}/restore`, null, {
        params: { role },
      });
      fetchTrash();
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm("This will permanently delete the item. Continue?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/trash/${type}/${id}`, {
        params: { role },
      });
      fetchTrash();
    } catch (err) {
      console.error("Failed to permanently delete:", err);
    }
  };

  const toggleItemSelection = (type, id) => {
    const itemKey = `${type}-${id}`;
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  const selectAllItems = () => {
    const allItems = new Set();
    folders.forEach((folder) => allItems.add(`folder-${folder._id}`));
    files.forEach((file) => allItems.add(`file-${file._id}`));
    setSelectedItems(allItems);
  };

  const selectNoneItems = () => {
    setSelectedItems(new Set());
  };

  const bulkRestore = async () => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Restore ${selectedItems.size} selected item(s)?`)) return;

    const requests = [];
    selectedItems.forEach((itemKey) => {
      const [type, id] = itemKey.split("-");
      const endpoint = type === "folder" ? "folders" : "files";
      requests.push(
        axios.patch(`${BACKEND_URL}/trash/${endpoint}/${id}/restore`, null, {
          params: { role },
        })
      );
    });

    try {
      await Promise.all(requests);
      setSelectedItems(new Set());
      fetchTrash();
      alert(`Successfully restored ${selectedItems.size} item(s).`);
    } catch (err) {
      console.error("Bulk restore failed:", err);
      alert("Some items could not be restored.");
    }
  };

  const bulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Permanently delete ${selectedItems.size} selected item(s)? This action cannot be undone.`)) {
      return;
    }

    const requests = [];
    selectedItems.forEach((itemKey) => {
      const [type, id] = itemKey.split("-");
      const endpoint = type === "folder" ? "folders" : "files";
      requests.push(
        axios.delete(`${BACKEND_URL}/trash/${endpoint}/${id}`, {
          params: { role },
        })
      );
    });

    try {
      await Promise.all(requests);
      setSelectedItems(new Set());
      fetchTrash();
      alert(`Successfully deleted ${selectedItems.size} item(s).`);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      alert("Some items could not be deleted.");
    }
  };

  const normalizedQuery = String(searchQuery || "").trim().toLowerCase();
  const matchesSearch = useCallback(
    (name, ownerEmail) => {
      if (!normalizedQuery) return true;
      return (
        String(name || "").toLowerCase().includes(normalizedQuery) ||
        String(ownerEmail || "").toLowerCase().includes(normalizedQuery)
      );
    },
    [normalizedQuery]
  );

  const visibleFolders = useMemo(
    () =>
      folders.filter((folder) =>
        matchesSearch(folder.name, folder?.owner?.email || "Unknown")
      ),
    [folders, matchesSearch]
  );

  const visibleFiles = useMemo(
    () =>
      files.filter((file) =>
        matchesSearch(file.originalName, file?.owner?.email || "Unknown")
      ),
    [files, matchesSearch]
  );

  const combinedVisibleItems = useMemo(() => {
    const folderItems = visibleFolders.map((folder) => ({
      key: `folder-${folder._id}`,
      id: folder._id,
      endpoint: "folders",
      kind: "folder",
      name: folder.name,
      owner: folder?.owner?.email || "Unknown",
      sizeLabel: "-",
      deletedAt: folder.deletedAt,
      typeLabel: "Folder",
      icon: <FaFolder className="trash-file-icon text-primary" />,
    }));

    const fileItems = visibleFiles.map((file) => {
      const extension = String(file?.mimetype || "").split("/")[1] || "File";
      return {
        key: `file-${file._id}`,
        id: file._id,
        endpoint: "files",
        kind: "file",
        name: file.originalName,
        owner: file?.owner?.email || "Unknown",
        sizeLabel: formatFileSize(file.size),
        deletedAt: file.deletedAt,
        typeLabel: extension.toUpperCase(),
        icon: iconByMime(file.mimetype),
      };
    });

    return [...folderItems, ...fileItems].sort((a, b) => {
      const left = new Date(a.deletedAt || 0).getTime();
      const right = new Date(b.deletedAt || 0).getTime();
      return right - left;
    });
  }, [visibleFolders, visibleFiles, iconByMime]);

  const totalItems = folders.length + files.length;
  const selectedCount = selectedItems.size;
  const hasItems = totalItems > 0;
  const hasVisibleItems = combinedVisibleItems.length > 0;

  const allItemsSelected = useMemo(
    () => hasItems && selectedItems.size === totalItems,
    [hasItems, selectedItems, totalItems]
  );

  return (
    <div className="container-fluid py-3 admin-trash-page">
      <section className="trash-hero-panel">
        <div className="trash-hero-copy">
          <h1 className="trash-title">Trash Repository</h1>
          <p className="trash-subtitle">
            Review and manage deleted academic resources and administrative records.
          </p>
        </div>
        <div className="trash-hero-tools">
          <label className="trash-search-shell" htmlFor="trash-search-input">
            <FaSearch aria-hidden="true" />
            <input
              id="trash-search-input"
              type="search"
              placeholder="Search trashed items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <div className="trash-view-toggle" role="group" aria-label="Trash view mode">
            <button
              type="button"
              className={view === "grid" ? "is-active" : ""}
              onClick={() => setView("grid")}
              title="Grid View"
            >
              <FaTh />
            </button>
            <button
              type="button"
              className={view === "list" ? "is-active" : ""}
              onClick={() => setView("list")}
              title="List View"
            >
              <FaList />
            </button>
          </div>
        </div>
      </section>

      {hasItems && (
        <section className="trash-toolbar-panel">
          <div className="trash-select-block">
            <button
              type="button"
              className="trash-select-toggle"
              onClick={allItemsSelected ? selectNoneItems : selectAllItems}
            >
              {allItemsSelected ? <FaCheckSquare /> : <FaSquare />}
              <span>{allItemsSelected ? "Select None" : "Select All"}</span>
            </button>
            <span className="trash-selection-meta">
              {selectedCount > 0 ? `${selectedCount} item(s) selected` : `${totalItems} item(s) in trash`}
            </span>
          </div>
          <div className="trash-bulk-actions">
            <button
              type="button"
              className="trash-action-btn restore"
              onClick={bulkRestore}
              disabled={selectedCount === 0}
            >
              <FaTrashRestore />
              <span>Restore Selected</span>
            </button>
            <button
              type="button"
              className="trash-action-btn delete"
              onClick={bulkDelete}
              disabled={selectedCount === 0}
            >
              <FaTrash />
              <span>Delete Selected</span>
            </button>
          </div>
        </section>
      )}

      {hasVisibleItems && view === "grid" && (
        <section className="trash-grid">
          {combinedVisibleItems.map((item) => {
            const isSelected = selectedItems.has(item.key);
            return (
              <article key={item.key} className={`trash-item-card ${isSelected ? "is-selected" : ""}`}>
                <div className="trash-card-head">
                  <button
                    type="button"
                    className={`trash-check-btn ${isSelected ? "is-selected" : ""}`}
                    onClick={() => toggleItemSelection(item.kind, item.id)}
                    aria-label={`Select ${item.name}`}
                  >
                    {isSelected ? <FaCheckSquare /> : <FaSquare />}
                  </button>
                  <span className={`trash-kind-pill kind-${item.kind}`}>{item.typeLabel}</span>
                </div>

                <div className={`trash-icon-shell kind-${item.kind}`}>{item.icon}</div>
                <h3 className="trash-item-name" title={item.name}>{item.name}</h3>
                <div className="trash-meta-line">
                  <FaUser />
                  <span title={item.owner}>{item.owner}</span>
                </div>
                <div className="trash-meta-line">
                  <FaClock />
                  <span>{formatDeletedLabel(item.deletedAt)}</span>
                </div>

                <div className="trash-card-actions">
                  <button
                    type="button"
                    className="trash-restore-btn"
                    onClick={() => restoreItem(item.endpoint, item.id)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="trash-delete-icon-btn"
                    onClick={() => deleteItem(item.endpoint, item.id)}
                    aria-label={`Permanently delete ${item.name}`}
                    title="Permanent delete"
                  >
                    <FaTimes />
                  </button>
                </div>
              </article>
            );
          })}

          <aside className="trash-cleanup-card">
            <div className="trash-cleanup-icon">
              <FaShieldAlt />
            </div>
            <h4>Auto-Cleanup Active</h4>
            <p>
              Items in trash are automatically deleted forever after 30 days of retention.
            </p>
          </aside>
        </section>
      )}

      {hasVisibleItems && view === "list" && (
        <section className="trash-table-shell">
          <table className="table align-middle mb-0 trash-list-table">
            <thead>
              <tr>
                <th className="trash-col-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allItemsSelected}
                    onChange={allItemsSelected ? selectNoneItems : selectAllItems}
                  />
                </th>
                <th>Name</th>
                <th>Owner</th>
                <th>Type</th>
                <th>Size</th>
                <th>Deleted</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {combinedVisibleItems.map((item) => {
                const isSelected = selectedItems.has(item.key);
                return (
                  <tr key={item.key} className={isSelected ? "is-selected" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.kind, item.id)}
                      />
                    </td>
                    <td>
                      <div className="trash-table-name">
                        {item.icon}
                        <span title={item.name}>{item.name}</span>
                      </div>
                    </td>
                    <td title={item.owner}>{item.owner}</td>
                    <td>{item.typeLabel}</td>
                    <td>{item.sizeLabel}</td>
                    <td>{formatDeletedLabel(item.deletedAt)}</td>
                    <td className="text-end">
                      <div className="trash-row-actions">
                        <button
                          type="button"
                          className="trash-restore-btn compact"
                          onClick={() => restoreItem(item.endpoint, item.id)}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="trash-delete-icon-btn compact"
                          onClick={() => deleteItem(item.endpoint, item.id)}
                          aria-label={`Permanently delete ${item.name}`}
                          title="Permanent delete"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {!hasVisibleItems && (
        <section className="trash-empty-state">
          <FaTrashRestore />
          <h5>{hasItems ? "No trashed items match your search" : "Trash is empty"}</h5>
          <p>
            {hasItems
              ? "Try another keyword or clear the search field."
              : "No trashed files or folders from any users."}
          </p>
        </section>
      )}
    </div>
  );
}
