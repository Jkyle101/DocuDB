import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";


export default function UploadModal({ onClose, onUploaded, parentFolder, hideDestinationFolder = false }) {
  const [file, setFile] = useState(null);
  const [folderItems, setFolderItems] = useState([]);
  const [destinationFolder, setDestinationFolder] = useState(parentFolder || "");
  const [allFolders, setAllFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [isCopcContext, setIsCopcContext] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [desiredType, setDesiredType] = useState("pdf");
  const [originalName, setOriginalName] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captures, setCaptures] = useState([]);
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFolder, setUploadingFolder] = useState(false);
  const [folderProgressText, setFolderProgressText] = useState("");
  const [uploadingSingle, setUploadingSingle] = useState(false);
  const [progress, setProgress] = useState({
    active: false,
    percent: 0,
    fileName: "",
    speedText: "0.00 MB/s",
    mode: "",
  });
  const speedRef = useRef({ lastLoaded: 0, lastTs: 0 });

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const isSecureContextForCamera =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const shouldHideDestination = hideDestinationFolder || isCopcContext;

  useEffect(() => {
    setDestinationFolder(parentFolder || "");
  }, [parentFolder]);

  useEffect(() => {
    const detectCopcContext = async () => {
      if (hideDestinationFolder) {
        setIsCopcContext(true);
        return;
      }
      if (!parentFolder) {
        setIsCopcContext(false);
        return;
      }
      try {
        const { data } = await axios.get(`${BACKEND_URL}/folders/${parentFolder}`);
        const profileKey = String(data?.complianceProfileKey || "").toUpperCase();
        const isCopcProgramRoot = !!data?.copc?.isProgramRoot;
        setIsCopcContext(profileKey.startsWith("COPC_") || isCopcProgramRoot);
      } catch {
        setIsCopcContext(false);
      }
    };
    detectCopcContext();
  }, [parentFolder, hideDestinationFolder]);

  useEffect(() => {
    if (shouldHideDestination) {
      setAllFolders([]);
      setLoadingFolders(false);
      return;
    }
    const loadFolders = async () => {
      try {
        setLoadingFolders(true);
        const userId = localStorage.getItem("userId");
        const role = localStorage.getItem("role");
        const { data } = await axios.get(`${BACKEND_URL}/folders/all`, {
          params: { userId, role },
        });
        setAllFolders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load folders:", err);
        setAllFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    };
    loadFolders();
  }, [shouldHideDestination]);

  const folderPathOptions = useMemo(() => {
    if (!allFolders.length) return [];
    const byId = new Map(allFolders.map((f) => [f._id, f]));
    const pathCache = new Map();
    const getPath = (id) => {
      if (pathCache.has(id)) return pathCache.get(id);
      const parts = [];
      let cursor = byId.get(id);
      const guard = new Set();
      while (cursor && !guard.has(cursor._id)) {
        guard.add(cursor._id);
        parts.unshift(cursor.name);
        cursor = cursor.parentFolder ? byId.get(cursor.parentFolder) : null;
      }
      const path = parts.join(" > ");
      pathCache.set(id, path);
      return path;
    };
    return allFolders
      .map((f) => ({ value: f._id, label: getPath(f._id) || f.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allFolders]);

  useEffect(() => {
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, []);

  const normalizeRelativePath = (value = "") =>
    String(value || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .trim();

  const filesFromInputList = (fileList) => {
    const picked = Array.from(fileList || [])
      .map((pickedFile) => {
        const relativePath = normalizeRelativePath(
          pickedFile.webkitRelativePath || pickedFile.relativePath || pickedFile.name
        );
        return relativePath ? { file: pickedFile, relativePath } : null;
      })
      .filter(Boolean);
    return picked;
  };

  const readDataTransferEntry = (entry, parentPath = "") =>
    new Promise((resolve) => {
      if (!entry) return resolve([]);
      if (entry.isFile) {
        entry.file(
          (fileEntry) =>
            resolve([
              {
                file: fileEntry,
                relativePath: normalizeRelativePath(`${parentPath}${fileEntry.name}`),
              },
            ]),
          () => resolve([])
        );
        return;
      }

      if (!entry.isDirectory) return resolve([]);

      const reader = entry.createReader();
      const entries = [];
      const readBatch = () => {
        reader.readEntries(
          (batch) => {
            if (!batch.length) {
              Promise.all(
                entries.map((child) =>
                  readDataTransferEntry(child, `${parentPath}${entry.name}/`)
                )
              ).then((nested) => resolve(nested.flat()));
              return;
            }
            entries.push(...batch);
            readBatch();
          },
          () => resolve([])
        );
      };
      readBatch();
    });

  const filesFromDataTransferItems = async (items) => {
    const list = Array.from(items || []);
    const hasEntryApi = list.some((item) => typeof item.webkitGetAsEntry === "function");
    if (!hasEntryApi) return [];

    const nested = await Promise.all(
      list.map((item) => readDataTransferEntry(item.webkitGetAsEntry()))
    );
    return nested.flat().filter((entry) => entry?.relativePath);
  };

  const predictDestination = async ({ filename, mimetype }) => {
    if (!filename) return;
    try {
      setPredicting(true);
      const userId = localStorage.getItem("userId");
      const role = localStorage.getItem("role");
      const { data } = await axios.post(`${BACKEND_URL}/files/predict-destination`, {
        userId,
        role,
        filename,
        mimetype,
      });
      setPrediction(data || null);
    } catch (err) {
      console.error("Predict destination failed:", err);
      setPrediction(null);
    } finally {
      setPredicting(false);
    }
  };

  const beginProgress = (fileName, mode = "upload") => {
    speedRef.current = { lastLoaded: 0, lastTs: Date.now() };
    setProgress({
      active: true,
      percent: 0,
      fileName: fileName || "Unknown",
      speedText: "0.00 MB/s",
      mode,
    });
  };

  const updateProgress = (loaded, total, fileName, mode = "upload") => {
    const now = Date.now();
    const prev = speedRef.current;
    const deltaBytes = Math.max(0, loaded - (prev.lastLoaded || 0));
    const deltaMs = Math.max(1, now - (prev.lastTs || now));
    const speedMBps = (deltaBytes / 1024 / 1024) / (deltaMs / 1000);
    speedRef.current = { lastLoaded: loaded, lastTs: now };

    const safeTotal = total && total > 0 ? total : loaded || 1;
    const percent = Math.min(100, Math.max(0, (loaded / safeTotal) * 100));
    setProgress((prevState) => ({
      ...prevState,
      active: true,
      mode,
      fileName: fileName || prevState.fileName,
      percent,
      speedText: `${speedMBps.toFixed(2)} MB/s`,
    }));
  };

  const endProgress = () => {
    setProgress((prevState) => ({ ...prevState, active: false, percent: 0, speedText: "0.00 MB/s" }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please choose a file");
      return;
    }

    try {
      setUploadingSingle(true);
      beginProgress(file.name, "single");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", localStorage.getItem("userId"));
      formData.append("role", localStorage.getItem("role")); // optional
      if (destinationFolder) formData.append("parentFolder", destinationFolder);

      const { data } = await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          updateProgress(evt.loaded || 0, evt.total || file.size || 1, file.name, "single");
        },
      });

      if (onUploaded) onUploaded(data.file);
      onClose();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please check backend logs.");
    } finally {
      setUploadingSingle(false);
      endProgress();
    }
  };

  const startCamera = async () => {
    try {
      setCameraError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Live camera is not supported on this browser.");
        return;
      }
      if (!isSecureContextForCamera) {
        setCameraError("Live camera requires HTTPS on mobile browsers. Use the mobile camera upload buttons below.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError("Unable to access live camera. On iPhone, use the 'Use Phone Camera' option.");
    }
  };

  const handleFolderInput = (e) => {
    const picked = filesFromInputList(e.target.files);
    setFolderItems(picked);
    if (picked[0]) {
      predictDestination({
        filename: picked[0].relativePath,
        mimetype: picked[0].file?.type,
      });
    }
    e.target.value = "";
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFromItems = await filesFromDataTransferItems(e.dataTransfer?.items);
    const droppedFiles =
      droppedFromItems.length > 0
        ? droppedFromItems
        : filesFromInputList(e.dataTransfer?.files);

    if (!droppedFiles.length) return;
    setFolderItems(droppedFiles);
    if (droppedFiles[0]) {
      predictDestination({
        filename: droppedFiles[0].relativePath,
        mimetype: droppedFiles[0].file?.type,
      });
    }
  };

  const uploadFolderTree = async () => {
    if (!folderItems.length) {
      alert("Please pick or drop a folder first.");
      return;
    }

    const userId = localStorage.getItem("userId");
    const role = localStorage.getItem("role");
    if (!userId) {
      alert("Missing user session.");
      return;
    }

    try {
      setUploadingFolder(true);
      setFolderProgressText("Preparing folder structure...");
      const totalBytes = folderItems.reduce((sum, item) => sum + (item.file?.size || 0), 0);
      let completedBytes = 0;

      const folderMap = new Map();
      folderMap.set("", destinationFolder || null);

      const folderPaths = new Set();
      for (const item of folderItems) {
        const parts = normalizeRelativePath(item.relativePath).split("/");
        if (parts.length <= 1) continue;
        let acc = "";
        for (let i = 0; i < parts.length - 1; i += 1) {
          acc = acc ? `${acc}/${parts[i]}` : parts[i];
          folderPaths.add(acc);
        }
      }

      const sortedFolderPaths = Array.from(folderPaths).sort(
        (a, b) => a.split("/").length - b.split("/").length
      );

      for (const folderPath of sortedFolderPaths) {
        const segments = folderPath.split("/");
        const name = segments[segments.length - 1];
        const parentPath = segments.slice(0, -1).join("/");
        const parentId = folderMap.get(parentPath) || null;

        setFolderProgressText(`Creating folder: ${folderPath}`);
        const { data } = await axios.post(`${BACKEND_URL}/folders`, {
          name,
          owner: userId,
          parentFolder: parentId,
        });
        folderMap.set(folderPath, data?.folder?._id || null);
      }

      let completed = 0;
      for (const item of folderItems) {
        const relative = normalizeRelativePath(item.relativePath);
        const folderPath = relative.includes("/")
          ? relative.split("/").slice(0, -1).join("/")
          : "";
        const parentId = folderMap.get(folderPath) || destinationFolder || null;

        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("userId", userId);
        formData.append("role", role || "user");
        if (parentId) formData.append("parentFolder", parentId);
        beginProgress(relative, "folder");

        await axios.post(`${BACKEND_URL}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evt) => {
            const loadedCurrent = evt.loaded || 0;
            updateProgress(
              completedBytes + loadedCurrent,
              totalBytes || completedBytes + (item.file?.size || 1),
              relative,
              "folder"
            );
          },
        });

        completed += 1;
        completedBytes += item.file?.size || 0;
        setFolderProgressText(`Uploading files: ${completed}/${folderItems.length}`);
      }

      setFolderItems([]);
      if (onUploaded) onUploaded();
      onClose();
    } catch (err) {
      console.error("Folder upload failed:", err);
      alert("Folder upload failed. Please check logs and try again.");
    } finally {
      setUploadingFolder(false);
      setFolderProgressText("");
      endProgress();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.92));
    setCaptures(prev => [...prev, blob]);
  };

  const removeCapture = (idx) => {
    setCaptures(prev => prev.filter((_, i) => i !== idx));
  };

  const appendCaptureFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const next = Array.from(fileList).map((f) => f);
    setCaptures((prev) => [...prev, ...next]);
  };

  const handleCameraInputChange = (e) => {
    appendCaptureFiles(e.target.files);
    const sourceName = originalName || e.target.files?.[0]?.name || "CameraCapture";
    predictDestination({ filename: sourceName, mimetype: "image/*" });
    e.target.value = "";
  };

  const handlePhotoInputChange = (e) => {
    appendCaptureFiles(e.target.files);
    const sourceName = originalName || e.target.files?.[0]?.name || "PhotoUpload";
    predictDestination({ filename: sourceName, mimetype: "image/*" });
    e.target.value = "";
  };

  const uploadCaptured = async () => {
    if (captures.length === 0) {
      alert("No captured images");
      return;
    }
    const formData = new FormData();
    captures.forEach((b, i) => {
      const filename = b?.name || `capture_${i + 1}.jpg`;
      formData.append("images", b, filename);
    });
    formData.append("userId", localStorage.getItem("userId"));
    formData.append("role", localStorage.getItem("role"));
    if (destinationFolder) formData.append("parentFolder", destinationFolder);
    formData.append("desiredType", desiredType);
    if (originalName) formData.append("originalName", originalName);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/upload-camera`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (onUploaded) onUploaded(data.file);
      setCaptures([]);
      setShowCamera(false);
      stopCamera();
      onClose();
    } catch (err) {
      console.error("Camera upload failed:", err);
      alert("Camera upload failed");
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="modal d-block " tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered ">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload File or Folder</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={submit}>
            <div className="modal-body">
              {progress.active && (
                <div className="alert alert-primary py-2 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <strong>Uploading: {Math.round(progress.percent)}%</strong>
                    <small>{progress.mode === "folder" ? "Folder Upload" : "File Upload"}</small>
                  </div>
                  <div className="progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin="0" aria-valuemax="100">
                    <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="small mt-2">
                    <div>File: <strong>{progress.fileName}</strong></div>
                    <div>Speed: {progress.speedText}</div>
                  </div>
                </div>
              )}

              <div className="d-flex gap-2 flex-wrap mb-3">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={uploadingFolder || uploadingSingle}
                >
                  Select Folder (with subfolders)
                </button>
                <input
                  ref={folderInputRef}
                  type="file"
                  className="d-none"
                  multiple
                  onChange={handleFolderInput}
                />
                {folderItems.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={uploadFolderTree}
                    disabled={uploadingFolder || uploadingSingle}
                  >
                    {uploadingFolder ? "Uploading folder..." : `Upload Folder (${folderItems.length} files)`}
                  </button>
                )}
              </div>

              <div
                className={`border rounded p-3 mb-3 ${dragActive ? "bg-light" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDrop={handleDrop}
              >
                <div className="small fw-semibold mb-1">Drag and drop folder upload</div>
                <div className="small text-muted">
                  Drop a folder here. DocuDB will preserve the full folder tree and upload all files automatically.
                </div>
                {folderItems.length > 0 && (
                  <div className="small mt-2">
                    Ready: <strong>{folderItems.length}</strong> files from folder tree
                  </div>
                )}
                {folderProgressText && (
                  <div className="small text-primary mt-2">{folderProgressText}</div>
                )}
              </div>

              <input
                type="file"
                className="form-control"
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                disabled={uploadingFolder || uploadingSingle}
                onChange={(e) => {
                  const picked = e.target.files[0];
                  setFile(picked);
                  if (picked) {
                    predictDestination({
                      filename: picked.name,
                      mimetype: picked.type,
                    });
                  }
                }}
              />
              <div className="mt-3">
                {!shouldHideDestination && (
                  <>
                    <label className="form-label mb-1">Destination Folder</label>
                    <select
                      className="form-select"
                      value={destinationFolder}
                      disabled={uploadingFolder || uploadingSingle}
                      onChange={(e) => setDestinationFolder(e.target.value)}
                    >
                      <option value="">Root</option>
                      {folderPathOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {loadingFolders && (
                      <div className="small text-muted mt-1">Loading folders...</div>
                    )}
                  </>
                )}
              </div>
              {!shouldHideDestination && (
                <>
                  <div className="mt-2 d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled={!file || predicting}
                      onClick={() =>
                        file &&
                        predictDestination({ filename: file.name, mimetype: file.type })
                      }
                    >
                      {predicting ? "Predicting..." : "Predict Destination"}
                    </button>
                    {prediction?.suggestedFolderId && (
                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm"
                        onClick={() => setDestinationFolder(prediction.suggestedFolderId)}
                      >
                        Use Suggested Folder
                      </button>
                    )}
                  </div>
                  {prediction && (
                    <div className="alert alert-secondary py-2 mt-2 mb-0">
                      <div className="small">
                        Suggested destination: <strong>{prediction.suggestedPath || "Root"}</strong>
                        {typeof prediction.confidence === "number" && (
                          <> ({Math.round(prediction.confidence * 100)}% match)</>
                        )}
                      </div>
                      {Array.isArray(prediction.alternatives) && prediction.alternatives.length > 1 && (
                        <div className="small text-muted mt-1">
                          Alternatives: {prediction.alternatives.slice(1).map((a) => a.path).join(" | ")}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                className="d-none"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleCameraInputChange}
              />
              <input
                ref={photoInputRef}
                type="file"
                className="d-none"
                accept="image/*"
                multiple
                onChange={handlePhotoInputChange}
              />
              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => {
                    const next = !showCamera;
                    setShowCamera(next);
                    if (next && !cameraActive) startCamera();
                    if (!next && cameraActive) stopCamera();
                  }}
                >
                  Upload using camera
                </button>
              </div>
              {showCamera && (
                <div className="mt-3">
                  <div className="alert alert-info py-2">
                    <div className="small">
                      Mobile Scan Upload: use <strong>Use Phone Camera</strong> to capture pages, then upload as PDF/DOCX/PPTX/XLSX.
                      {isIOS && " For iPhone Safari, this method is more reliable than live camera."}
                    </div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      Use Phone Camera
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      Add From Photos
                    </button>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <video
                        ref={videoRef}
                        className="w-100 rounded border"
                        playsInline
                        muted
                      />
                      <div className="d-flex gap-2 mt-2">
                        <button
                          type="button"
                          className={`btn ${cameraActive ? "btn-outline-secondary" : "btn-primary"}`}
                          onClick={() => (cameraActive ? stopCamera() : startCamera())}
                        >
                          {cameraActive ? "Stop Camera" : "Start Camera"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={capturePhoto}
                          disabled={!cameraActive}
                        >
                          Capture
                        </button>
                      </div>
                      {cameraError && (
                        <div className="text-danger small mt-2">{cameraError}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label">Output Type</label>
                        <select
                          className="form-select"
                          value={desiredType}
                          onChange={(e) => setDesiredType(e.target.value)}
                        >
                          <option value="pdf">PDF</option>
                          <option value="docx">Word (DOCX)</option>
                          <option value="pptx">PowerPoint (PPTX)</option>
                          <option value="xlsx">Excel (XLSX)</option>
                        </select>
                      </div>
                      <div className="mb-2">
                        <label className="form-label">File Name (optional)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="CameraCapture"
                          value={originalName}
                          onChange={(e) => setOriginalName(e.target.value)}
                        />
                      </div>
                      <div className="mb-2">
                        <div className="d-flex flex-wrap gap-2">
                          {captures.map((blob, idx) => (
                            <div key={idx} className="position-relative">
                              <img
                                src={URL.createObjectURL(blob)}
                                alt="Capture"
                                style={{ width: "96px", height: "72px", objectFit: "cover" }}
                                className="rounded border"
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-danger position-absolute top-0 end-0"
                                onClick={() => removeCapture(idx)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={uploadCaptured}
                        disabled={captures.length === 0}
                      >
                        Upload Captured
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose} disabled={uploadingFolder || uploadingSingle}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success" disabled={uploadingFolder || uploadingSingle}>
                Upload
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
