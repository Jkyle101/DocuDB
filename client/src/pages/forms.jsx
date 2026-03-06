import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

const emptyField = { key: "", label: "", type: "text", required: false, placeholder: "" };

export default function FormsPage() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [values, setValues] = useState({});
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    outputType: "docx",
    templateBody: "",
    fields: [emptyField],
    destinationFolder: "",
  });
  const [folders, setFolders] = useState([]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t._id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${BACKEND_URL}/form-templates`, {
        params: { userId, role },
      });
      setTemplates(Array.isArray(data) ? data : []);
      if (!selectedTemplateId && Array.isArray(data) && data.length > 0) {
        setSelectedTemplateId(data[0]._id);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/folders/all`, {
        params: { userId, role },
      });
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
    if (!selectedTemplate) {
      setValues({});
      return;
    }
    const next = {};
    (selectedTemplate.fields || []).forEach((f) => {
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

  const addField = () => {
    setForm((prev) => ({ ...prev, fields: [...prev.fields, { ...emptyField }] }));
  };

  const removeField = (index) => {
    setForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
  };

  const createTemplate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.templateBody.trim()) {
      alert("Template name and body are required");
      return;
    }
    const cleanedFields = (form.fields || [])
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
        fields: cleanedFields,
        destinationFolder: form.destinationFolder || null,
      });
      setForm({
        name: "",
        description: "",
        outputType: "docx",
        templateBody: "",
        fields: [emptyField],
        destinationFolder: "",
      });
      await loadTemplates();
      alert("Template created");
    } catch (err) {
      console.error("Failed to create template:", err);
      alert("Failed to create template");
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/form-templates/${id}`, {
        params: { userId, role },
      });
      if (selectedTemplateId === id) setSelectedTemplateId("");
      await loadTemplates();
    } catch (err) {
      console.error("Failed to delete template:", err);
      alert("Failed to delete template");
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
      console.error("Failed to generate document:", err);
      alert("Failed to generate document");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="row g-4">
        <div className="col-12 col-xl-5">
          <div className="card">
            <div className="card-header fw-semibold">Smart Form Builder - Create Template</div>
            <div className="card-body">
              <form onSubmit={createTemplate}>
                <div className="mb-2">
                  <label className="form-label">Template Name</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Description</label>
                  <input
                    className="form-control"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <label className="form-label">Output Type</label>
                    <select
                      className="form-select"
                      value={form.outputType}
                      onChange={(e) => setForm((p) => ({ ...p, outputType: e.target.value }))}
                    >
                      <option value="docx">DOCX</option>
                      <option value="pdf">PDF</option>
                      <option value="txt">TXT</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Destination Folder</label>
                    <select
                      className="form-select"
                      value={form.destinationFolder}
                      onChange={(e) => setForm((p) => ({ ...p, destinationFolder: e.target.value }))}
                    >
                      <option value="">Root</option>
                      {folders.map((f) => (
                        <option key={f._id} value={f._id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label">Fields</label>
                  {(form.fields || []).map((field, idx) => (
                    <div className="border rounded p-2 mb-2" key={`${field.key}-${idx}`}>
                      <div className="row g-2">
                        <div className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            placeholder="key"
                            value={field.key}
                            onChange={(e) => updateField(idx, { key: e.target.value })}
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            placeholder="label"
                            value={field.label}
                            onChange={(e) => updateField(idx, { label: e.target.value })}
                          />
                        </div>
                        <div className="col-md-3">
                          <select
                            className="form-select form-select-sm"
                            value={field.type}
                            onChange={(e) => updateField(idx, { type: e.target.value })}
                          >
                            <option value="text">text</option>
                            <option value="textarea">textarea</option>
                            <option value="number">number</option>
                            <option value="date">date</option>
                            <option value="email">email</option>
                          </select>
                        </div>
                        <div className="col-md-2 d-flex align-items-center">
                          <input
                            type="checkbox"
                            className="form-check-input me-1"
                            checked={field.required}
                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                          />
                          <small>Required</small>
                        </div>
                        <div className="col-md-1 text-end">
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeField(idx)}>
                            x
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addField}>
                    Add Field
                  </button>
                </div>

                <div className="mb-3">
                  <label className="form-label">Template Body (use placeholders like {'{{clientName}}'})</label>
                  <textarea
                    className="form-control"
                    rows={8}
                    value={form.templateBody}
                    onChange={(e) => setForm((p) => ({ ...p, templateBody: e.target.value }))}
                  />
                </div>
                <button className="btn btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Template"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="card">
            <div className="card-header fw-semibold">Templates and Generation</div>
            <div className="card-body">
              {loading ? (
                <div>Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-muted">No templates yet.</div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="form-label">Select Template</label>
                    <select
                      className="form-select"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                      <option value="">Choose...</option>
                      {templates.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedTemplate && (
                    <>
                      <div className="mb-3">
                        <div className="fw-semibold">{selectedTemplate.name}</div>
                        <div className="small text-muted">{selectedTemplate.description || "No description"}</div>
                        <div className="small text-muted">Output: {selectedTemplate.outputType?.toUpperCase()}</div>
                      </div>
                      <div className="border rounded p-3 mb-3">
                        <div className="fw-semibold mb-2">Fill Fields</div>
                        {(selectedTemplate.fields || []).length === 0 ? (
                          <div className="text-muted small">No fields defined. Generation uses static template body.</div>
                        ) : (
                          selectedTemplate.fields.map((f) => (
                            <div className="mb-2" key={f.key}>
                              <label className="form-label mb-1">
                                {f.label} {f.required ? "*" : ""}
                              </label>
                              {f.type === "textarea" ? (
                                <textarea
                                  className="form-control"
                                  value={values[f.key] || ""}
                                  placeholder={f.placeholder || ""}
                                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                                />
                              ) : (
                                <input
                                  className="form-control"
                                  type={f.type || "text"}
                                  value={values[f.key] || ""}
                                  placeholder={f.placeholder || ""}
                                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                                />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-success" onClick={generateDocument} disabled={generating}>
                          {generating ? "Generating..." : "Generate Document"}
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => deleteTemplate(selectedTemplate._id)}>
                          Delete Template
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

