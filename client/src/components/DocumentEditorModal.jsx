import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

export default function DocumentEditorModal({ file, onClose, onSaved }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeDescription, setChangeDescription] = useState("");
  const [kind, setKind] = useState("text");

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const extension = useMemo(() => {
    const name = (file?.originalName || "").toLowerCase();
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx) : "";
  }, [file?.originalName]);

  useEffect(() => {
    const loadContent = async () => {
      if (!file?._id) return;
      try {
        setLoading(true);
        const { data } = await axios.get(`${BACKEND_URL}/files/${file._id}/content`, {
          params: { userId, role },
        });
        setContent(data?.content || "");
        setKind(data?.kind || "text");
      } catch (err) {
        console.error("Failed to load document content:", err);
        alert("Failed to open document editor");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [file?._id, onClose, role, userId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data } = await axios.patch(`${BACKEND_URL}/files/${file._id}/content`, {
        userId,
        role,
        content,
        changeDescription: changeDescription || "Edited in built-in document editor",
      });
      if (onSaved) onSaved(data?.file || file);
      onClose();
    } catch (err) {
      console.error("Failed to save document content:", err);
      alert("Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1" style={{ zIndex: 1100 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Built-in Editor - {file?.originalName}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body d-flex flex-column gap-2">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="small text-muted">
                Editable type: {kind || extension || file?.mimetype || "text"} | Save shortcut: Ctrl/Cmd + S
              </div>
              <div className="d-flex align-items-center gap-2">
                <input
                  className="form-control form-control-sm"
                  style={{ minWidth: 320 }}
                  placeholder="Change description for version history"
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                />
              </div>
            </div>
            {loading ? (
              <div className="text-muted">Loading editor...</div>
            ) : (
              <>
                {(kind === "docx" || kind === "xlsx" || kind === "pdf" || kind === "pptx") && (
                  <div className="alert alert-warning py-2 mb-2">
                    <small>
                      Editing this format uses content-layer mode. Original complex layout may be simplified when saved.
                    </small>
                  </div>
                )}
                <textarea
                  className="form-control"
                  style={{ minHeight: "72vh", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

