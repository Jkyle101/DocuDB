import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";

function Upload({ onClose, currentFolderId }) {
  const [file, setFile] = useState(null);
  const [desiredType, setDesiredType] = useState("pdf");
  const [originalName, setOriginalName] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please choose a file");

    const formData = new FormData();
    formData.append("file", file);

    // attach logged-in userId from localStorage
    formData.append("userId", localStorage.getItem("userId")); 

    // include folder (if inside one)
    if (currentFolderId) {
      formData.append("parentFolder", currentFolderId);
    }

    try {
      await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("File uploaded successfully!");
      if (onClose) onClose(true); // pass true to indicate refresh needed
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
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
    } catch (err) {
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
    setCapturedPreview(URL.createObjectURL(blob));

    const formData = new FormData();
    formData.append("image", blob, "capture.png");
    formData.append("userId", localStorage.getItem("userId"));
    if (currentFolderId) formData.append("parentFolder", currentFolderId);
    formData.append("desiredType", desiredType);
    if (originalName) formData.append("originalName", originalName);

    try {
      await axios.post(`${BACKEND_URL}/upload-camera`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Camera file uploaded successfully!");
      if (onClose) onClose(true);
    } catch (err) {
      console.error("Camera upload error:", err);
      alert("Upload failed");
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-2">
          <label className="form-label">Select a file</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>
        <button type="submit" className="btn btn-success">
          Upload
        </button>
      </form>

      <div className="card">
        <div className="card-header">Capture from Camera</div>
        <div className="card-body">
          <div className="mb-3">
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
              <option value="image">Image</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">File Name (optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="CameraCapture"
              value={originalName}
              onChange={(e) => setOriginalName(e.target.value)}
            />
          </div>

          <div className="d-flex align-items-center gap-3 mb-3">
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
              Capture & Upload
            </button>
          </div>

          <div className="row">
            <div className="col-md-6">
              <video ref={videoRef} className="w-100 rounded border" />
            </div>
            <div className="col-md-6">
              {capturedPreview && (
                <img src={capturedPreview} alt="Captured" className="w-100 rounded border" />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Upload;
