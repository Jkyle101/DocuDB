import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";


export default function UploadModal({ onClose, onUploaded, parentFolder }) {
  const [file, setFile] = useState(null);
  const [destinationFolder, setDestinationFolder] = useState(parentFolder || "");
  const [allFolders, setAllFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [desiredType, setDesiredType] = useState("pdf");
  const [originalName, setOriginalName] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captures, setCaptures] = useState([]);
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const isSecureContextForCamera =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  useEffect(() => {
    setDestinationFolder(parentFolder || "");
  }, [parentFolder]);

  useEffect(() => {
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
  }, []);

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

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please choose a file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", localStorage.getItem("userId"));
      formData.append("role", localStorage.getItem("role")); // optional
      if (destinationFolder) formData.append("parentFolder", destinationFolder);

      const { data } = await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (onUploaded) onUploaded(data.file);
      onClose();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please check backend logs.");
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
            <h5 className="modal-title">Upload File</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={submit}>
            <div className="modal-body">
              <input
                type="file"
                className="form-control"
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
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
                <label className="form-label mb-1">Destination Folder</label>
                <select
                  className="form-select"
                  value={destinationFolder}
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
              </div>
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
              <button type="button" className="btn btn-light" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success">
                Upload
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
