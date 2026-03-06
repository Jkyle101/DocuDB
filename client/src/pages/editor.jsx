import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { BACKEND_URL } from "../config";
import {
  FaSave,
  FaArrowLeft,
  FaUndo,
  FaRedo,
  FaBold,
  FaItalic,
  FaUnderline,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaTable,
  FaColumns,
  FaCalendarAlt,
  FaPlus,
  FaThLarge,
  FaCompressArrowsAlt,
  FaExpandArrowsAlt,
} from "react-icons/fa";
import "./editor.css";

function parseCsv(content) {
  return (content || "")
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

function toCsv(rows) {
  return (rows || []).map((r) => (r || []).join(",")).join("\n");
}

function parseSlides(content) {
  const blocks = (content || "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return [{ title: "Slide 1", body: "" }];
  return blocks.map((block, idx) => {
    const lines = block.split(/\r?\n/);
    const first = (lines[0] || "").trim();
    const title = first.replace(/^#\s*/, "").trim() || `Slide ${idx + 1}`;
    const body = lines.slice(1).join("\n").trim();
    return { title, body };
  });
}

function slidesToText(slides) {
  return (slides || [])
    .map((s, idx) => `# ${s.title || `Slide ${idx + 1}`}\n${s.body || ""}`.trim())
    .join("\n\n");
}

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [file, setFile] = useState(null);
  const [kind, setKind] = useState("text");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [sheetRows, setSheetRows] = useState([[""]]);
  const [slides, setSlides] = useState([{ title: "Slide 1", body: "" }]);
  const [ribbonTab, setRibbonTab] = useState("home");
  const [fontSize, setFontSize] = useState(14);
  const [wrapText, setWrapText] = useState(true);
  const [sheetGrid, setSheetGrid] = useState(true);
  const [slideCompact, setSlideCompact] = useState(false);
  const docEditorRef = useRef(null);

  const previewUrl = useMemo(() => {
    if (!file?.filename) return "";
    return `${BACKEND_URL}/preview/${file.filename}?userId=${userId}&role=${role}`;
  }, [file?.filename, role, userId]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [fileRes, contentRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/files/${id}`),
          axios.get(`${BACKEND_URL}/files/${id}/content`, { params: { userId, role } }),
        ]);
        setFile(fileRes.data);
        const data = contentRes.data || {};
        const loadedKind = data.kind || "text";
        setKind(loadedKind);
        setContent(data.content || "");
        if (loadedKind === "xlsx") setSheetRows(parseCsv(data.content || ""));
        if (loadedKind === "pptx") setSlides(parseSlides(data.content || ""));
      } catch (err) {
        console.error("Failed to open editor:", err);
        alert("Failed to open editor");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate, role, userId]);

  useEffect(() => {
    if (!loading && kind === "docx" && docEditorRef.current) {
      docEditorRef.current.innerText = content || "";
    }
  }, [kind, loading, id]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      let payloadContent = content;
      if (kind === "xlsx") payloadContent = toCsv(sheetRows);
      if (kind === "pptx") payloadContent = slidesToText(slides);

      await axios.patch(`${BACKEND_URL}/files/${id}/content`, {
        userId,
        role,
        content: payloadContent,
        changeDescription: changeDescription || "Edited in full-page editor",
      });
      alert("Saved");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateCell = (r, c, value) => {
    setSheetRows((prev) => {
      const next = prev.map((row) => [...row]);
      if (!next[r]) next[r] = [];
      next[r][c] = value;
      return next;
    });
  };

  const addRow = () => {
    setSheetRows((prev) => [...prev, new Array(Math.max(1, prev[0]?.length || 1)).fill("")]);
  };

  const addColumn = () => {
    setSheetRows((prev) => prev.map((row) => [...row, ""]));
  };

  const addSlide = () => setSlides((prev) => [...prev, { title: `Slide ${prev.length + 1}`, body: "" }]);
  const removeSlide = (idx) => setSlides((prev) => prev.filter((_, i) => i !== idx));

  const applyDocCommand = (command, value = null) => {
    if (kind !== "docx" || !docEditorRef.current) return;
    docEditorRef.current.focus();
    document.execCommand(command, false, value);
    setContent(docEditorRef.current.innerText || "");
  };

  const insertDateTime = () => {
    const stamp = new Date().toLocaleString();
    if (kind === "docx" && docEditorRef.current) {
      applyDocCommand("insertText", stamp);
      return;
    }
    if (kind === "xlsx") {
      setSheetRows((prev) => {
        const next = prev.map((r) => [...r]);
        if (!next[0]) next[0] = [""];
        next[0][0] = `${next[0][0] || ""} ${stamp}`.trim();
        return next;
      });
      return;
    }
    if (kind === "pptx") {
      setSlides((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, body: `${s.body || ""}\n${stamp}`.trim() } : s))
      );
      return;
    }
    setContent((prev) => `${prev || ""}\n${stamp}`.trim());
  };

  const insertTemplateBlock = () => {
    const block = "\nTitle:\nSummary:\nNotes:\n";
    if (kind === "xlsx") {
      addRow();
      return;
    }
    if (kind === "pptx") {
      addSlide();
      return;
    }
    if (kind === "docx" && docEditorRef.current) {
      applyDocCommand("insertText", block);
      return;
    }
    setContent((prev) => `${prev || ""}\n${block}`.trim());
  };

  if (loading) {
    return <div className="text-muted">Loading editor...</div>;
  }

  return (
    <div className="container-fluid office-editor-page">
      <div className="card office-editor-card">
        <div className="office-topbar d-flex justify-content-between align-items-center">
          <div className="office-file-name">
            {file?.originalName} <span className="text-muted">({kind})</span>
          </div>
          <div className="office-qat">
            <button className="btn btn-sm office-qat-btn" title="Back" onClick={() => navigate(-1)}>
              <FaArrowLeft />
            </button>
            <button className="btn btn-sm office-qat-btn" title="Save" onClick={handleSave} disabled={saving}>
              <FaSave />
            </button>
            <button
              className="btn btn-sm office-qat-btn"
              title="Undo"
              onClick={() => (kind === "docx" ? applyDocCommand("undo") : null)}
              disabled={kind !== "docx"}
            >
              <FaUndo />
            </button>
            <button
              className="btn btn-sm office-qat-btn"
              title="Redo"
              onClick={() => (kind === "docx" ? applyDocCommand("redo") : null)}
              disabled={kind !== "docx"}
            >
              <FaRedo />
            </button>
          </div>
        </div>
        <div className="card-body">
          <ul className="nav office-ribbon-tabs mb-0">
            <li className="nav-item">
              <button
                className={`nav-link ${ribbonTab === "home" ? "active" : ""}`}
                onClick={() => setRibbonTab("home")}
              >
                Home
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${ribbonTab === "insert" ? "active" : ""}`}
                onClick={() => setRibbonTab("insert")}
              >
                Insert
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${ribbonTab === "layout" ? "active" : ""}`}
                onClick={() => setRibbonTab("layout")}
              >
                Layout
              </button>
            </li>
          </ul>

          <div className="office-ribbon mb-3">
            {ribbonTab === "home" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group">
                  <div className="ribbon-group-body">
                    <button className="btn ribbon-icon-btn" title="Save" onClick={handleSave} disabled={saving}>
                      <FaSave />
                    </button>
                    <button className="btn ribbon-icon-btn" title="Undo" onClick={() => kind === "docx" && applyDocCommand("undo")} disabled={kind !== "docx"}>
                      <FaUndo />
                    </button>
                    <button className="btn ribbon-icon-btn" title="Redo" onClick={() => kind === "docx" && applyDocCommand("redo")} disabled={kind !== "docx"}>
                      <FaRedo />
                    </button>
                  </div>
                  <div className="ribbon-group-label">Clipboard</div>
                </div>
                <div className="ribbon-sep" />
                <div className="ribbon-group">
                  <div className="ribbon-group-body">
                    {kind === "docx" ? (
                      <>
                        <button className="btn ribbon-icon-btn" title="Bold" onClick={() => applyDocCommand("bold")}>
                          <FaBold />
                        </button>
                        <button className="btn ribbon-icon-btn" title="Italic" onClick={() => applyDocCommand("italic")}>
                          <FaItalic />
                        </button>
                        <button className="btn ribbon-icon-btn" title="Underline" onClick={() => applyDocCommand("underline")}>
                          <FaUnderline />
                        </button>
                      </>
                    ) : (
                      <button className="btn ribbon-icon-btn" title="Wrap Text" onClick={() => setWrapText((v) => !v)}>
                        <FaThLarge />
                      </button>
                    )}
                  </div>
                  <div className="ribbon-group-label">Font</div>
                </div>
                <div className="ribbon-sep" />
                <div className="ribbon-group">
                  <div className="ribbon-group-body">
                    {kind === "docx" && (
                      <>
                        <button className="btn ribbon-icon-btn" title="Align Left" onClick={() => applyDocCommand("justifyLeft")}>
                          <FaAlignLeft />
                        </button>
                        <button className="btn ribbon-icon-btn" title="Center" onClick={() => applyDocCommand("justifyCenter")}>
                          <FaAlignCenter />
                        </button>
                        <button className="btn ribbon-icon-btn" title="Align Right" onClick={() => applyDocCommand("justifyRight")}>
                          <FaAlignRight />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="ribbon-group-label">Paragraph</div>
                </div>
              </div>
            )}

            {ribbonTab === "insert" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group">
                  <div className="ribbon-group-body">
                    <button className="btn ribbon-icon-btn" title="Date/Time" onClick={insertDateTime}>
                      <FaCalendarAlt />
                    </button>
                    <button className="btn ribbon-icon-btn" title="Template Block" onClick={insertTemplateBlock}>
                      <FaPlus />
                    </button>
                  </div>
                  <div className="ribbon-group-label">Insert</div>
                </div>
                {(kind === "xlsx" || kind === "pptx") && <div className="ribbon-sep" />}
                {kind === "xlsx" && (
                  <div className="ribbon-group">
                    <div className="ribbon-group-body">
                      <button className="btn ribbon-icon-btn" title="Add Row" onClick={addRow}>
                        <FaTable />
                      </button>
                      <button className="btn ribbon-icon-btn" title="Add Column" onClick={addColumn}>
                        <FaColumns />
                      </button>
                    </div>
                    <div className="ribbon-group-label">Cells</div>
                  </div>
                )}
                {kind === "pptx" && (
                  <div className="ribbon-group">
                    <div className="ribbon-group-body">
                      <button className="btn ribbon-icon-btn" title="New Slide" onClick={addSlide}>
                        <FaPlus />
                      </button>
                    </div>
                    <div className="ribbon-group-label">Slides</div>
                  </div>
                )}
              </div>
            )}

            {ribbonTab === "layout" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group">
                  <div className="ribbon-group-body">
                    <label className="small text-muted mb-0">Font</label>
                    <input
                      type="range"
                      min="11"
                      max="22"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                    />
                    <span className="small">{fontSize}px</span>
                  </div>
                  <div className="ribbon-group-label">Text</div>
                </div>
                {(kind === "xlsx" || kind === "pptx") && <div className="ribbon-sep" />}
                {kind === "xlsx" && (
                  <div className="ribbon-group">
                    <div className="ribbon-group-body">
                      <button className="btn ribbon-icon-btn" onClick={() => setSheetGrid((v) => !v)} title={sheetGrid ? "Hide Grid" : "Show Grid"}>
                        {sheetGrid ? <FaCompressArrowsAlt /> : <FaExpandArrowsAlt />}
                      </button>
                    </div>
                    <div className="ribbon-group-label">Grid</div>
                  </div>
                )}
                {kind === "pptx" && (
                  <div className="ribbon-group">
                    <div className="ribbon-group-body">
                      <button className="btn ribbon-icon-btn" onClick={() => setSlideCompact((v) => !v)} title={slideCompact ? "Normal Slides" : "Compact Slides"}>
                        {slideCompact ? <FaExpandArrowsAlt /> : <FaCompressArrowsAlt />}
                      </button>
                    </div>
                    <div className="ribbon-group-label">Slides</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-2">
            <input
              className="form-control form-control-sm"
              placeholder="Change description for version history"
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
            />
          </div>

          {(kind === "docx" || kind === "pdf" || kind === "pptx" || kind === "xlsx") && (
            <div className="alert alert-warning py-2">
              <small>
                Office-style mode: content editing is format-aware, and file is regenerated on save.
              </small>
            </div>
          )}

          {kind === "text" && (
            <textarea
              className="form-control"
              style={{
                minHeight: "72vh",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: `${fontSize}px`,
                whiteSpace: wrapText ? "pre-wrap" : "pre",
              }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}

          {kind === "docx" && (
            <div className="border rounded p-3" style={{ minHeight: "72vh", background: "#fff" }}>
              <div className="small text-muted mb-2">Word-style editing surface</div>
              <div
                ref={docEditorRef}
                contentEditable
                suppressContentEditableWarning
                style={{
                  minHeight: "64vh",
                  outline: "none",
                  whiteSpace: wrapText ? "pre-wrap" : "pre",
                  fontSize: `${fontSize}px`,
                }}
                onInput={(e) => setContent(e.currentTarget.innerText || "")}
              />
            </div>
          )}

          {kind === "xlsx" && (
            <div>
              <div className="d-flex gap-2 mb-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={addRow}>
                  Add Row
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={addColumn}>
                  Add Column
                </button>
              </div>
              <div className="table-responsive border rounded" style={{ maxHeight: "70vh" }}>
                <table className={`table table-sm ${sheetGrid ? "table-bordered" : ""} mb-0`}>
                  <tbody>
                    {sheetRows.map((row, r) => (
                      <tr key={`r-${r}`}>
                        {row.map((cell, c) => (
                          <td key={`c-${r}-${c}`} style={{ minWidth: 140 }}>
                            <input
                              className="form-control form-control-sm border-0"
                              style={{ fontSize: `${fontSize}px` }}
                              value={cell || ""}
                              onChange={(e) => updateCell(r, c, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {kind === "pdf" && (
            <div className="row g-3">
              <div className="col-lg-6">
                <div className="border rounded overflow-hidden">
                  <iframe title="pdf-preview" src={previewUrl} style={{ width: "100%", height: "72vh", border: "none" }} />
                </div>
              </div>
              <div className="col-lg-6">
                <textarea
                  className="form-control"
                  style={{
                    minHeight: "72vh",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    fontSize: `${fontSize}px`,
                    whiteSpace: wrapText ? "pre-wrap" : "pre",
                  }}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </div>
          )}

          {kind === "pptx" && (
            <div>
              <div className="d-flex gap-2 mb-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={addSlide}>
                  Add Slide
                </button>
              </div>
              <div className="d-flex flex-column gap-3">
                {slides.map((slide, idx) => (
                  <div key={`slide-${idx}`} className={`border rounded p-3 bg-white ${slideCompact ? "py-2" : ""}`}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fw-semibold">Slide {idx + 1}</div>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => removeSlide(idx)}>
                        Remove
                      </button>
                    </div>
                    <input
                      className="form-control mb-2"
                      value={slide.title}
                      onChange={(e) =>
                        setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)))
                      }
                      placeholder="Slide title"
                    />
                    <textarea
                      className="form-control"
                      rows={slideCompact ? 3 : 6}
                      style={{ fontSize: `${fontSize}px` }}
                      value={slide.body}
                      onChange={(e) =>
                        setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, body: e.target.value } : s)))
                      }
                      placeholder="Slide content"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
