import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaChartBar,
  FaBook,
  FaClipboardCheck,
  FaCommentDots,
  FaEnvelope,
  FaFileAlt,
  FaFileContract,
  FaFileExport,
  FaFileInvoiceDollar,
  FaFileSignature,
  FaFolderOpen,
  FaListOl,
  FaMagic,
  FaPaintBrush,
  FaPlus,
  FaSave,
  FaTrash,
  FaEye,
  FaExpandArrowsAlt,
  FaCompressArrowsAlt,
} from "react-icons/fa";
import { BACKEND_URL } from "../config";
import "./editor.css";
import "./forms.css";

const emptyField = { key: "", label: "", type: "text", required: false, placeholder: "" };

const SMART_TEMPLATES = [
  {
    id: "reports",
    name: "Reports",
    icon: FaChartBar,
    data: {
      name: "Monthly Report",
      description: "Monthly operations report",
      outputType: "docx",
      fields: [
        { key: "title", label: "Report Title", type: "text", required: true, placeholder: "Monthly Operations Report" },
        { key: "period", label: "Period", type: "text", required: true, placeholder: "March 2026" },
        { key: "summary", label: "Summary", type: "textarea", required: true, placeholder: "Key highlights" },
      ],
      templateBody: "Title: {{title}}\nPeriod: {{period}}\n\nSummary\n{{summary}}",
    },
  },
  {
    id: "invoices",
    name: "Invoices",
    icon: FaFileInvoiceDollar,
    data: {
      name: "Invoice",
      description: "Client billing invoice",
      outputType: "pdf",
      fields: [
        { key: "invoiceNo", label: "Invoice #", type: "text", required: true, placeholder: "INV-2026-001" },
        { key: "client", label: "Client", type: "text", required: true, placeholder: "Client Name" },
        { key: "total", label: "Total", type: "text", required: true, placeholder: "$0.00" },
      ],
      templateBody: "INVOICE\nNo: {{invoiceNo}}\nClient: {{client}}\nTotal Due: {{total}}",
    },
  },
  {
    id: "memos",
    name: "Memos",
    icon: FaFileAlt,
    data: {
      name: "Memo",
      description: "Internal memo template",
      outputType: "docx",
      fields: [
        { key: "to", label: "To", type: "text", required: true, placeholder: "Team" },
        { key: "from", label: "From", type: "text", required: true, placeholder: "Manager" },
        { key: "body", label: "Message", type: "textarea", required: true, placeholder: "Memo body" },
      ],
      templateBody: "MEMO\nTo: {{to}}\nFrom: {{from}}\n\n{{body}}",
    },
  },
  {
    id: "legal",
    name: "Legal Forms",
    icon: FaFileContract,
    data: {
      name: "Service Agreement",
      description: "Basic legal agreement template",
      outputType: "docx",
      fields: [
        { key: "partyA", label: "Party A", type: "text", required: true, placeholder: "Company A" },
        { key: "partyB", label: "Party B", type: "text", required: true, placeholder: "Company B" },
        { key: "scope", label: "Scope", type: "textarea", required: true, placeholder: "Work scope" },
      ],
      templateBody: "SERVICE AGREEMENT\nBetween {{partyA}} and {{partyB}}\n\nScope\n{{scope}}",
    },
  },
];

export default function FormsPage() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "faculty";

  const [ribbonTab, setRibbonTab] = useState("home");
  const [mode, setMode] = useState("create");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const [folders, setFolders] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [values, setValues] = useState({});

  const [form, setForm] = useState({
    name: "",
    description: "",
    outputType: "docx",
    templateBody: "",
    fields: [emptyField],
    destinationFolder: "",
  });

  const [reportData, setReportData] = useState({
    reportTitle: "Auto Generated Document Activity Report",
    period: "",
    summary: "",
    totalDocuments: "",
    newUploads: "",
    duplicateFiles: "",
    outputType: "docx",
    destinationFolder: "",
  });

  const selectedTemplate = useMemo(
    () => templates.find((t) => t._id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );
  const [viewMode, setViewMode] = useState("normal");
  const [designPreset, setDesignPreset] = useState("default");

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${BACKEND_URL}/form-templates`, { params: { userId, role } });
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      if (!selectedTemplateId && list.length) setSelectedTemplateId(list[0]._id);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/folders/all`, { params: { userId, role } });
      setFolders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load folders:", err);
      setFolders([]);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadFolders();
  }, []);

  useEffect(() => {
    const next = {};
    (selectedTemplate?.fields || []).forEach((f) => {
      next[f.key] = "";
    });
    setValues(next);
  }, [selectedTemplate]);

  const updateField = (index, patch) => {
    setForm((prev) => {
      const fields = [...prev.fields];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, fields };
    });
  };

  const applySmartTemplate = (tplId) => {
    const tpl = SMART_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setForm((prev) => ({ ...prev, ...tpl.data, fields: [...tpl.data.fields] }));
    setMode("create");
  };

  const addField = () => setForm((prev) => ({ ...prev, fields: [...prev.fields, { ...emptyField }] }));
  const removeField = (idx) => setForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));

  const createTemplate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.templateBody.trim()) return alert("Template name and body are required");
    const fields = (form.fields || [])
      .map((f) => ({
        key: (f.key || "").trim(),
        label: (f.label || "").trim(),
        type: f.type || "text",
        required: !!f.required,
        placeholder: (f.placeholder || "").trim(),
      }))
      .filter((f) => f.key && f.label);
    try {
      setCreating(true);
      await axios.post(`${BACKEND_URL}/form-templates`, {
        userId,
        role,
        name: form.name.trim(),
        description: form.description.trim(),
        outputType: form.outputType,
        templateBody: form.templateBody,
        fields,
        destinationFolder: form.destinationFolder || null,
      });
      await loadTemplates();
      alert("Template created");
    } catch (err) {
      console.error(err);
      alert("Failed to create template");
    } finally {
      setCreating(false);
    }
  };

  const generateDocument = async () => {
    if (!selectedTemplate) return;
    try {
      setGenerating(true);
      const { data } = await axios.post(`${BACKEND_URL}/form-templates/${selectedTemplate._id}/generate`, {
        userId,
        role,
        values,
      });
      alert(`Generated: ${data?.file?.originalName || "document"}`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate document");
    } finally {
      setGenerating(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate || !window.confirm("Delete this template?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/form-templates/${selectedTemplate._id}`, { params: { userId, role } });
      setSelectedTemplateId("");
      await loadTemplates();
    } catch (err) {
      console.error(err);
      alert("Failed to delete template");
    }
  };

  const generateAutoReport = async () => {
    try {
      setAutoGenerating(true);
      const { data } = await axios.post(`${BACKEND_URL}/reports/auto-generate`, { userId, role, reportData });
      alert(`Report generated: ${data?.file?.originalName || "report"}`);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to generate report");
    } finally {
      setAutoGenerating(false);
    }
  };

  const appendTemplateSnippet = (snippet) => {
    if (!snippet) return;
    setMode("create");
    setForm((prev) => ({
      ...prev,
      templateBody: prev.templateBody ? `${prev.templateBody}\n${snippet}` : snippet,
    }));
  };

  const addMailMergeToken = (token) => appendTemplateSnippet(`{{${token}}}`);

  const runTemplateReview = () => {
    const fields = form.fields || [];
    const keys = fields.map((f) => (f.key || "").trim()).filter(Boolean);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (!form.name.trim()) return alert("Review: Template name is required.");
    if (!form.templateBody.trim()) return alert("Review: Template body is required.");
    if (duplicates.length) return alert(`Review: Duplicate field keys found (${[...new Set(duplicates)].join(", ")})`);
    alert("Review passed: template structure looks valid.");
  };

  const applyDesignPreset = (preset) => {
    setDesignPreset(preset);
    if (preset === "formal") appendTemplateSnippet("=== Document Header ===");
    if (preset === "compact") appendTemplateSnippet("[Compact Style Enabled]");
    if (preset === "newsletter") appendTemplateSnippet("[Newsletter Layout]");
  };

  return (
    <div className="container-fluid office-editor-page office-forms-page">
      <div className="card office-editor-card">
        <div className="office-topbar d-flex justify-content-between align-items-center">
          <div className="office-file-name">Smart Form Builder <span className="text-muted">(Office Style)</span></div>
          <div className="office-qat">
            <button className="btn btn-sm office-qat-btn" onClick={() => setMode("create")} title="Builder"><FaFileSignature /></button>
            <button className="btn btn-sm office-qat-btn" onClick={() => setMode("generate")} title="Generate"><FaClipboardCheck /></button>
            <button className="btn btn-sm office-qat-btn" onClick={() => setMode("report")} title="Auto Reports"><FaChartBar /></button>
          </div>
        </div>

        <div className="card-body">
          <ul className="nav office-ribbon-tabs mb-0">
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "home" ? "active" : ""}`} onClick={() => setRibbonTab("home")}>Home</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "insert" ? "active" : ""}`} onClick={() => setRibbonTab("insert")}>Insert</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "layout" ? "active" : ""}`} onClick={() => setRibbonTab("layout")}>Layout</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "references" ? "active" : ""}`} onClick={() => setRibbonTab("references")}>References</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "review" ? "active" : ""}`} onClick={() => setRibbonTab("review")}>Review</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "view" ? "active" : ""}`} onClick={() => setRibbonTab("view")}>View</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "design" ? "active" : ""}`} onClick={() => setRibbonTab("design")}>Design</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "mailings" ? "active" : ""}`} onClick={() => setRibbonTab("mailings")}>Mailings</button></li>
            <li className="nav-item"><button className={`nav-link ${ribbonTab === "file" ? "active" : ""}`} onClick={() => setRibbonTab("file")}>File</button></li>
          </ul>

          <div className="office-ribbon mb-3">
            {ribbonTab === "home" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={() => setMode("create")} title="Create"><FaFileSignature /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => setMode("generate")} title="Generate"><FaMagic /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => setMode("report")} title="Auto Report"><FaChartBar /></button>
                </div><div className="ribbon-group-label">Workspace</div></div>
                <div className="ribbon-sep" />
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={loadTemplates} title="Refresh"><FaSave /></button>
                  <button className="btn ribbon-icon-btn" onClick={addField} title="Add Field" disabled={mode !== "create"}><FaPlus /></button>
                </div><div className="ribbon-group-label">Actions</div></div>
              </div>
            )}
            {ribbonTab === "insert" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group">
                  <div className="ribbon-group-body">
                    <button className="btn ribbon-icon-btn" onClick={addField} title="Insert Field" disabled={mode !== "create"}><FaPlus /></button>
                    <button className="btn ribbon-icon-btn" onClick={() => appendTemplateSnippet("[Table: 4 columns]")} title="Insert Table"><FaListOl /></button>
                    <button className="btn ribbon-icon-btn" onClick={() => appendTemplateSnippet("[Image Placeholder]")} title="Insert Image"><FaFileAlt /></button>
                  </div>
                  <div className="ribbon-group-label">Insert Elements</div>
                </div>
                <div className="ribbon-sep" />
                {SMART_TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon;
                  return (
                    <div className="ribbon-group" key={tpl.id}>
                      <div className="ribbon-group-body">
                        <button className="btn ribbon-icon-btn" onClick={() => applySmartTemplate(tpl.id)} title={tpl.name}><Icon /></button>
                      </div>
                      <div className="ribbon-group-label">{tpl.name}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {ribbonTab === "layout" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={() => setMode("report")} title="Open Auto-Report"><FaChartBar /></button>
                </div><div className="ribbon-group-label">Auto-Generated Reports</div></div>
              </div>
            )}
            {ribbonTab === "references" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={() => appendTemplateSnippet("[Citation: source]")} title="Insert Citation"><FaBook /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => appendTemplateSnippet("Table of Contents\n1. Section A\n2. Section B")} title="Insert TOC"><FaListOl /></button>
                </div><div className="ribbon-group-label">Citations & TOC</div></div>
              </div>
            )}
            {ribbonTab === "review" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={runTemplateReview} title="Validate Template"><FaClipboardCheck /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => appendTemplateSnippet("[Comment: pending review]")} title="Add Comment"><FaCommentDots /></button>
                </div><div className="ribbon-group-label">Tracking & Comments</div></div>
              </div>
            )}
            {ribbonTab === "view" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className={`btn ribbon-icon-btn ${viewMode === "normal" ? "active" : ""}`} onClick={() => setViewMode("normal")} title="Normal View"><FaEye /></button>
                  <button className={`btn ribbon-icon-btn ${viewMode === "focused" ? "active" : ""}`} onClick={() => setViewMode("focused")} title="Focused View"><FaExpandArrowsAlt /></button>
                  <button className={`btn ribbon-icon-btn ${viewMode === "compact" ? "active" : ""}`} onClick={() => setViewMode("compact")} title="Compact View"><FaCompressArrowsAlt /></button>
                </div><div className="ribbon-group-label">Display Modes</div></div>
              </div>
            )}
            {ribbonTab === "design" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={() => applyDesignPreset("default")} title="Default"><FaPaintBrush /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => applyDesignPreset("formal")} title="Formal"><FaFileContract /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => applyDesignPreset("newsletter")} title="Newsletter"><FaFileAlt /></button>
                </div><div className="ribbon-group-label">Styles</div></div>
              </div>
            )}
            {ribbonTab === "mailings" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={() => addMailMergeToken("recipient_name")} title="Recipient Name"><FaEnvelope /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => addMailMergeToken("recipient_email")} title="Recipient Email"><FaEnvelope /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => addMailMergeToken("recipient_address")} title="Recipient Address"><FaEnvelope /></button>
                </div><div className="ribbon-group-label">Merge Fields</div></div>
              </div>
            )}
            {ribbonTab === "file" && (
              <div className="office-ribbon-row">
                <div className="ribbon-group"><div className="ribbon-group-body">
                  <button className="btn ribbon-icon-btn" onClick={loadTemplates} title="Refresh Templates"><FaSave /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => setMode("generate")} title="Open Templates"><FaFolderOpen /></button>
                  <button className="btn ribbon-icon-btn" onClick={() => alert("Use Generate or Auto Report to export files.")} title="Export"><FaFileExport /></button>
                </div><div className="ribbon-group-label">File</div></div>
              </div>
            )}
          </div>

          <div className={`forms-workspace ${viewMode === "compact" ? "forms-workspace-compact" : ""}`}>
            <div className="forms-sidebar border rounded p-3 bg-white">
              <div className="fw-semibold mb-2">Smart Templates</div>
              <div className="small text-muted mb-3">Reports, Invoices, Memos, Legal Forms</div>
              <div className="d-flex flex-column gap-2">
                {SMART_TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon;
                  return (
                    <button key={tpl.id} type="button" className="btn btn-sm btn-outline-primary text-start d-flex align-items-center gap-2" onClick={() => applySmartTemplate(tpl.id)}>
                      <Icon /> {tpl.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="forms-main border rounded p-3 bg-white"
              style={{
                maxWidth: viewMode === "focused" ? "980px" : "none",
                margin: viewMode === "focused" ? "0 auto" : "0",
                background: designPreset === "formal" ? "#fcfaf5" : designPreset === "newsletter" ? "#f6fbff" : "#fff",
              }}
            >
              {mode === "create" && (
                <form onSubmit={createTemplate}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">Template Builder</h6>
                    <button className="btn btn-primary btn-sm" disabled={creating}>{creating ? "Creating..." : "Create Template"}</button>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6"><input className="form-control" placeholder="Template Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
                    <div className="col-md-6"><input className="form-control" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-4">
                      <select className="form-select" value={form.outputType} onChange={(e) => setForm((p) => ({ ...p, outputType: e.target.value }))}>
                        <option value="docx">DOCX</option><option value="pdf">PDF</option><option value="txt">TXT</option>
                      </select>
                    </div>
                    <div className="col-md-8">
                      <select className="form-select" value={form.destinationFolder} onChange={(e) => setForm((p) => ({ ...p, destinationFolder: e.target.value }))}>
                        <option value="">Root destination</option>
                        {folders.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-2">
                    {(form.fields || []).map((field, idx) => (
                      <div key={`${field.key}-${idx}`} className="border rounded p-2 mb-2">
                        <div className="row g-2">
                          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="key" value={field.key} onChange={(e) => updateField(idx, { key: e.target.value })} /></div>
                          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="label" value={field.label} onChange={(e) => updateField(idx, { label: e.target.value })} /></div>
                          <div className="col-md-2">
                            <select className="form-select form-select-sm" value={field.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                              <option value="text">text</option><option value="textarea">textarea</option><option value="number">number</option><option value="date">date</option><option value="email">email</option>
                            </select>
                          </div>
                          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="placeholder" value={field.placeholder || ""} onChange={(e) => updateField(idx, { placeholder: e.target.value })} /></div>
                          <div className="col-md-1 d-flex align-items-center justify-content-between">
                            <input type="checkbox" className="form-check-input" checked={field.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
                            <button type="button" className="btn btn-sm btn-outline-danger ms-1" onClick={() => removeField(idx)}><FaTrash /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <textarea className="form-control" rows={10} placeholder="Template body with {{placeholders}}" value={form.templateBody} onChange={(e) => setForm((p) => ({ ...p, templateBody: e.target.value }))} />
                </form>
              )}

              {mode === "generate" && (
                <div>
                  <h6>Generate from Template</h6>
                  {loading ? <div className="text-muted">Loading templates...</div> : (
                    <>
                      <select className="form-select mb-3" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                        <option value="">Choose template...</option>
                        {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                      {selectedTemplate && (
                        <div className="border rounded p-3">
                          {(selectedTemplate.fields || []).map((f) => (
                            <div className="mb-2" key={f.key}>
                              <label className="form-label mb-1">{f.label}{f.required ? "*" : ""}</label>
                              {f.type === "textarea" ? (
                                <textarea className="form-control" value={values[f.key] || ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                              ) : (
                                <input className="form-control" type={f.type || "text"} value={values[f.key] || ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                              )}
                            </div>
                          ))}
                          <div className="d-flex gap-2 mt-2">
                            <button className="btn btn-success" onClick={generateDocument} disabled={generating}>{generating ? "Generating..." : "Generate Document"}</button>
                            <button className="btn btn-outline-danger" onClick={deleteTemplate}>Delete Template</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {mode === "report" && (
                <div>
                  <h6>Auto-Generated Reports</h6>
                  <p className="small text-muted">Generate report documents automatically using provided data.</p>
                  <div className="row g-2">
                    <div className="col-md-8"><input className="form-control" placeholder="Report title" value={reportData.reportTitle} onChange={(e) => setReportData((p) => ({ ...p, reportTitle: e.target.value }))} /></div>
                    <div className="col-md-4"><input className="form-control" placeholder="Period" value={reportData.period} onChange={(e) => setReportData((p) => ({ ...p, period: e.target.value }))} /></div>
                    <div className="col-md-12"><textarea className="form-control" rows={3} placeholder="Summary" value={reportData.summary} onChange={(e) => setReportData((p) => ({ ...p, summary: e.target.value }))} /></div>
                    <div className="col-md-4"><input className="form-control" placeholder="Total documents" value={reportData.totalDocuments} onChange={(e) => setReportData((p) => ({ ...p, totalDocuments: e.target.value }))} /></div>
                    <div className="col-md-4"><input className="form-control" placeholder="New uploads" value={reportData.newUploads} onChange={(e) => setReportData((p) => ({ ...p, newUploads: e.target.value }))} /></div>
                    <div className="col-md-4"><input className="form-control" placeholder="Duplicate files" value={reportData.duplicateFiles} onChange={(e) => setReportData((p) => ({ ...p, duplicateFiles: e.target.value }))} /></div>
                    <div className="col-md-4">
                      <select className="form-select" value={reportData.outputType} onChange={(e) => setReportData((p) => ({ ...p, outputType: e.target.value }))}>
                        <option value="docx">DOCX</option><option value="pdf">PDF</option><option value="txt">TXT</option>
                      </select>
                    </div>
                    <div className="col-md-8">
                      <select className="form-select" value={reportData.destinationFolder} onChange={(e) => setReportData((p) => ({ ...p, destinationFolder: e.target.value }))}>
                        <option value="">Root destination</option>
                        {folders.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary mt-3" onClick={generateAutoReport} disabled={autoGenerating}>{autoGenerating ? "Generating..." : "Generate Report Document"}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

