import React, { useState, useEffect } from "react";
import { BACKEND_URL } from "../config";
import { FaTimes, FaDownload, FaExpand } from "react-icons/fa";

export default function FilePreview({ file, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const fileUrl = `${BACKEND_URL}/view/${file.filename}?userId=${userId}`;
  const previewUrl = `${BACKEND_URL}/preview/${file.filename}?userId=${userId}&role=${role}`;
  const downloadUrl = `${BACKEND_URL}/download/${file.filename}?userId=${userId}`;
  const nameLower = (file.originalName || "").toLowerCase();

  // Determine if file can be previewed in browser
  const isDocx = file.mimetype?.includes("wordprocessingml") || nameLower.endsWith(".docx");
  const isXlsx = file.mimetype?.includes("spreadsheetml") || file.mimetype?.includes("vnd.ms-excel") || nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls");
  const isPptx = file.mimetype?.includes("presentationml") || nameLower.endsWith(".pptx") || nameLower.endsWith(".ppt");
  const isImage = file.mimetype?.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif"].some((ext) => nameLower.endsWith(ext));
  const isVideo = file.mimetype?.startsWith("video/");
  const isAudio = file.mimetype?.startsWith("audio/");
  const isPDF = file.mimetype === "application/pdf" || nameLower.endsWith(".pdf");
  const isText = file.mimetype?.startsWith("text/") || file.mimetype === "application/json" || [".txt", ".json", ".xml", ".csv"].some((ext) => nameLower.endsWith(ext));
  const canPreview = isImage || isVideo || isAudio || isPDF || isText || isDocx || isXlsx || isPptx;

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [file.filename]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError("Unable to preview this file type. Please download to view.");
  };

  return (
    <div className="modal d-block" tabIndex="-1" style={{ zIndex: 9999 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content bg-dark">
          <div className="modal-header bg-dark border-secondary">
            <h5 className="modal-title text-white">{file.originalName}</h5>
            <div className="d-flex gap-2">
              {file.permissions === "write" && (
                <a
                  href={downloadUrl}
                  className="btn btn-sm btn-outline-light"
                  download
                >
                  <FaDownload className="me-1" /> Download
                </a>
              )}
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
              ></button>
            </div>
          </div>
          <div className="modal-body p-0 bg-dark d-flex align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
            {loading && (
              <div className="text-white text-center">
                <div className="spinner-border text-light" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading preview...</p>
              </div>
            )}
            {error && (
              <div className="text-white text-center p-4">
                <p>{error}</p>
                {file.permissions === "write" && (
                  <a href={downloadUrl} className="btn btn-primary" download>
                    <FaDownload className="me-2" /> Download File
                  </a>
                )}
              </div>
            )}
            {canPreview && !error && (
              <div className="w-100 h-100 d-flex align-items-center justify-content-center" style={{ maxHeight: "80vh" }}>
                {isImage && (
                  <img
                    src={fileUrl}
                    alt={file.originalName}
                    className="img-fluid"
                    style={{ maxHeight: "80vh", maxWidth: "100%" }}
                    onLoad={handleLoad}
                    onError={handleError}
                  />
                )}
                {isVideo && (
                  <video
                    src={fileUrl}
                    controls
                    className="w-100"
                    style={{ maxHeight: "80vh" }}
                    onLoadedData={handleLoad}
                    onError={handleError}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                {isAudio && (
                  <div className="w-100 p-4 text-center">
                    <audio
                      src={fileUrl}
                      controls
                      className="w-100"
                      onLoadedData={handleLoad}
                      onError={handleError}
                    >
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                )}
                {isPDF && (
                  <iframe
                    src={previewUrl}
                    className="w-100"
                    style={{ height: "80vh", border: "none" }}
                    onLoad={handleLoad}
                    onError={handleError}
                    title={file.originalName}
                  ></iframe>
                )}
                {(isDocx || isXlsx || isPptx) && (
                  <iframe
                    src={previewUrl}
                    className="w-100 bg-white"
                    style={{ height: "80vh", border: "none" }}
                    onLoad={handleLoad}
                    onError={handleError}
                    title={file.originalName}
                  ></iframe>
                )}
                {isText && (
                  <iframe
                    src={previewUrl}
                    className="w-100 bg-white"
                    style={{ height: "80vh", border: "none" }}
                    onLoad={handleLoad}
                    onError={handleError}
                    title={file.originalName}
                  ></iframe>
                )}
              </div>
            )}
            {!canPreview && !error && (
              <div className="text-white text-center p-4">
                <p>This file type cannot be previewed in the browser.</p>
                {file.permissions === "write" && (
                  <a href={downloadUrl} className="btn btn-primary" download>
                    <FaDownload className="me-2" /> Download File
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
