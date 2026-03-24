import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { FaDownload, FaRegStickyNote } from "react-icons/fa";

export default function FilePreview({ file, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [activePdfPage, setActivePdfPage] = useState(1);

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  const fileUrl = `${BACKEND_URL}/view/${file.filename}?userId=${userId}&role=${role}`;
  const previewUrl = `${BACKEND_URL}/preview/${file.filename}?userId=${userId}&role=${role}`;
  const downloadUrl = `${BACKEND_URL}/download/${file.filename}?userId=${userId}&role=${role}`;
  const nameLower = (file.originalName || "").toLowerCase();

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
    setPreviewMeta(null);
    setActivePdfPage(1);
  }, [file.filename]);

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

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError("Unable to preview this file type. Please download to view.");
  };

  const pageCount = Math.max(1, Math.min(previewMeta?.pageCount || 1, 40));
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i + 1), [pageCount]);
  const annotations = previewMeta?.annotations || [];

  const annotationsByPage = useMemo(() => {
    const map = {};
    for (const ann of annotations) {
      if (!ann.pageNumber) continue;
      if (!map[ann.pageNumber]) map[ann.pageNumber] = [];
      map[ann.pageNumber].push(ann);
    }
    return map;
  }, [annotations]);

  const mainPdfUrl = `${fileUrl}#page=${activePdfPage}&zoom=page-width`;

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
            {loading && (
              <div className="text-white text-center pt-4">
                <div className="spinner-border text-light" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading preview...</p>
              </div>
            )}

            {error && (
              <div className="text-white text-center p-4">
                <p>{error}</p>
                <a href={downloadUrl} className="btn btn-primary" download>
                  <FaDownload className="me-2" /> Download File
                </a>
              </div>
            )}

            {canPreview && !error && (
              <div className="w-100 h-100" style={{ maxHeight: "80vh" }}>
                {isPDF ? (
                  <div className="d-flex h-100">
                    <div
                      className="border-end border-secondary bg-black"
                      style={{ width: 160, overflowY: "auto", padding: 8 }}
                    >
                      <div className="text-light small mb-2">
                        Pages {metaLoading ? "..." : `(${pageCount})`}
                      </div>
                      {pages.map((pageNum) => {
                        const hasAnnotations = (annotationsByPage[pageNum] || []).length > 0;
                        return (
                          <button
                            key={pageNum}
                            className={`btn w-100 mb-2 p-1 ${activePdfPage === pageNum ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => setActivePdfPage(pageNum)}
                          >
                            <div className="bg-white" style={{ height: 90, overflow: "hidden" }}>
                              <iframe
                                src={`${fileUrl}#page=${pageNum}&zoom=35`}
                                title={`thumb-${pageNum}`}
                                style={{ width: "100%", height: "220%", border: "none", pointerEvents: "none", transform: "scale(0.46)", transformOrigin: "top left" }}
                              />
                            </div>
                            <div className="small mt-1 d-flex justify-content-between align-items-center">
                              <span>Page {pageNum}</span>
                              {hasAnnotations && <FaRegStickyNote title="Has annotations" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex-grow-1">
                      <iframe
                        src={mainPdfUrl}
                        className="w-100"
                        style={{ height: "80vh", border: "none" }}
                        onLoad={handleLoad}
                        onError={handleError}
                        title={file.originalName}
                      ></iframe>
                    </div>

                    <div
                      className="border-start border-secondary bg-black text-light"
                      style={{ width: 320, overflowY: "auto", padding: 12 }}
                    >
                      <div className="fw-semibold mb-2">Annotation Highlights</div>
                      {annotations.length === 0 ? (
                        <div className="text-secondary small">No annotations yet.</div>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          {annotations.map((ann) => (
                            <button
                              key={ann.id}
                              className="btn btn-sm btn-outline-light text-start"
                              onClick={() => {
                                if (ann.pageNumber) setActivePdfPage(ann.pageNumber);
                              }}
                            >
                              <div className="small text-info">
                                {ann.pageNumber ? `Page ${ann.pageNumber}` : "General"} - {ann.author}
                              </div>
                              <div className="small text-truncate">{ann.content}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-100 h-100 d-flex align-items-center justify-content-center">
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
                    {(isDocx || isXlsx || isPptx || isText) && (
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

