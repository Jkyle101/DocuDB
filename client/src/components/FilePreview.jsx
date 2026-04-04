import React, { useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { FaDownload } from "react-icons/fa";
import UniversalDocViewer from "./UniversalDocViewer";
import { isAudioFile, isImageFile, isOfficeDocument, isPdfFile, isTextLikeFile, isVideoFile } from "../utils/fileType";

export default function FilePreview({ file, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const fileUrl = `${BACKEND_URL}/view/${file.filename}?userId=${userId}&role=${role}`;
  const previewUrl = `${BACKEND_URL}/preview/${file.filename}?userId=${userId}&role=${role}`;
  const downloadUrl = `${BACKEND_URL}/download/${file.filename}?userId=${userId}&role=${role}`;

  const isPDF = isPdfFile(file);
  const canPreview =
    isPDF ||
    isImageFile(file) ||
    isVideoFile(file) ||
    isAudioFile(file) ||
    isOfficeDocument(file) ||
    isTextLikeFile(file);

  useEffect(() => {
    setLoading(false);
    setError(null);
    setPreviewMeta(null);
  }, [file.filename, isPDF]);

  useEffect(() => {
    const fetchPreviewMeta = async () => {
      if (!isPDF || !file?._id) return;
      try {
        setMetaLoading(true);
        const res = await axios.get(`${BACKEND_URL}/files/${file._id}/preview-metadata`, {
          params: { userId, role },
        });
        setPreviewMeta(res.data || null);
      } catch (err) {
        console.error("Failed to fetch preview metadata:", err);
        setPreviewMeta(null);
      } finally {
        setMetaLoading(false);
      }
    };

    fetchPreviewMeta();
  }, [isPDF, file?._id, userId, role]);

  const annotations = previewMeta?.annotations || [];
  const showPreviewLoading = loading;
  const showPreviewError = Boolean(error);

  return (
    <div className="modal d-block" tabIndex="-1" style={{ zIndex: 9999 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content bg-dark">
          <div className="modal-header bg-dark border-secondary">
            <h5 className="modal-title text-white">{file.originalName}</h5>
            <div className="d-flex gap-2">
              <a
                href={downloadUrl}
                className="btn btn-sm btn-outline-light"
                download
              >
                <FaDownload className="me-1" /> Download
              </a>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
              ></button>
            </div>
          </div>

          <div className="modal-body p-0 bg-dark" style={{ minHeight: "80vh" }}>
            {showPreviewLoading && (
              <div className="text-white text-center pt-4">
                <div className="spinner-border text-light" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading preview...</p>
              </div>
            )}

            {showPreviewError && (
              <div className="text-white text-center p-4">
                <p>{error}</p>
                <a href={downloadUrl} className="btn btn-primary" download>
                  <FaDownload className="me-2" /> Download File
                </a>
              </div>
            )}

            {canPreview && !error && (
              <div className="w-100 h-100" style={{ maxHeight: "80vh" }}>
                <UniversalDocViewer
                  file={file}
                  viewUrl={fileUrl}
                  previewUrl={previewUrl}
                  annotations={annotations}
                  annotationLoading={metaLoading}
                  showAnnotationPane={isPDF}
                  minHeight={620}
                />
              </div>
            )}

            {!canPreview && !error && (
              <div className="text-white text-center p-4">
                <p>This file type cannot be previewed in the browser.</p>
                <a href={downloadUrl} className="btn btn-primary" download>
                  <FaDownload className="me-2" /> Download File
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

