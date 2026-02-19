import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";


export default function UploadModal({ onClose, onUploaded, parentFolder }) {
  const [file, setFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [desiredType, setDesiredType] = useState("pdf");
  const [originalName, setOriginalName] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captures, setCaptures] = useState([]);

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
      if (parentFolder) formData.append("parentFolder", parentFolder);

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      alert("Unable to access camera");
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

  const uploadCaptured = async () => {
    if (captures.length === 0) {
      alert("No captured images");
      return;
    }
    const formData = new FormData();
    captures.forEach((b, i) => formData.append("images", b, `capture_${i + 1}.png`));
    formData.append("userId", localStorage.getItem("userId"));
    if (parentFolder) formData.append("parentFolder", parentFolder);
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
                onChange={(e) => setFile(e.target.files[0])}
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
                  <div className="row g-3">
                    <div className="col-md-6">
                      <video ref={videoRef} className="w-100 rounded border" />
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
