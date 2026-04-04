import "../utils/pdfCompat";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./PdfViewer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.2;

function clampPage(page, numPages) {
  if (!numPages) return 1;
  return Math.min(Math.max(page, 1), numPages);
}

export default function PdfViewer({
  fileUrl,
  title = "PDF document",
  annotations = [],
  annotationLoading = false,
  showAnnotationPane = false,
  minHeight = 560,
}) {
  const stageRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [loadError, setLoadError] = useState("");
  const [stageWidth, setStageWidth] = useState(0);

  useEffect(() => {
    setNumPages(0);
    setPageNumber(1);
    setPageInput("1");
    setZoom(1);
    setLoadError("");
  }, [fileUrl]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setStageWidth(element.clientWidth || 0);
    };

    updateWidth();

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  const pageWidth = useMemo(() => {
    const availableWidth = stageWidth > 0 ? Math.max(300, Math.floor(stageWidth - 32)) : 780;
    return Math.max(280, Math.floor(availableWidth * zoom));
  }, [stageWidth, zoom]);

  const showNotes = showAnnotationPane || annotationLoading || annotations.length > 0;
  const canGoPrev = pageNumber > 1;
  const canGoNext = numPages > 0 && pageNumber < numPages;
  const zoomPercent = Math.round(zoom * 100);

  const commitPageInput = () => {
    const numeric = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(numeric)) {
      setPageInput(String(pageNumber));
      return;
    }

    setPageNumber(clampPage(numeric, numPages));
  };

  const handleDocumentLoadSuccess = ({ numPages: nextNumPages }) => {
    setLoadError("");
    setNumPages(nextNumPages);
    setPageNumber((current) => clampPage(current, nextNumPages));
  };

  const handleDocumentLoadError = (error) => {
    setLoadError(error?.message || "Failed to load this PDF.");
  };

  const viewerStyle = { "--pdf-viewer-min-height": `${minHeight}px` };

  return (
    <div className="pdf-viewer" style={viewerStyle}>
      <div className="pdf-viewer-toolbar">
        <div className="pdf-viewer-toolbar-group">
          <span className="pdf-viewer-toolbar-label" title={title}>
            Page
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setPageNumber((current) => Math.max(current - 1, 1))}
            disabled={!canGoPrev}
          >
            Prev
          </button>
          <input
            className="form-control form-control-sm pdf-viewer-page-input"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commitPageInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitPageInput();
              }
            }}
            aria-label="Current page"
          />
          <span className="pdf-viewer-quiet">of {numPages || "--"}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setPageNumber((current) => Math.min(current + 1, numPages || current + 1))}
            disabled={!canGoNext}
          >
            Next
          </button>
        </div>

        <div className="pdf-viewer-toolbar-group">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(2))))}
            disabled={zoom <= MIN_ZOOM}
          >
            -
          </button>
          <span className="pdf-viewer-toolbar-label">{zoomPercent}%</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))))}
            disabled={zoom >= MAX_ZOOM}
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
          >
            Fit Width
          </button>
        </div>
      </div>

      <div className={`pdf-viewer-body ${showNotes ? "has-annotations" : ""}`}>
        <div className="pdf-viewer-stage" ref={stageRef}>
          {loadError ? (
            <div className="pdf-viewer-error">
              <p>{loadError}</p>
              <a className="btn btn-outline-primary" href={fileUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </div>
          ) : (
            <div className="pdf-viewer-stage-inner">
              <Document
                key={fileUrl}
                file={fileUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={
                  <div className="pdf-viewer-loading">
                    <div className="spinner-border" role="status" aria-hidden="true" />
                    <span>Loading PDF...</span>
                  </div>
                }
                error={null}
                noData={<div className="pdf-viewer-empty">No PDF file was provided.</div>}
              >
                <div className="pdf-viewer-page-shell">
                  <Page
                    pageNumber={pageNumber}
                    width={pageWidth}
                    renderTextLayer={false}
                    loading={
                      <div className="pdf-viewer-loading">
                        <div className="spinner-border" role="status" aria-hidden="true" />
                        <span>Rendering page...</span>
                      </div>
                    }
                  />
                </div>
              </Document>
            </div>
          )}
        </div>

        {showNotes && (
          <aside className="pdf-viewer-sidebar">
            <div className="pdf-viewer-sidebar-head">
              <div className="pdf-viewer-sidebar-title">Annotation Highlights</div>
              {annotationLoading && <div className="pdf-viewer-sidebar-note">Loading...</div>}
            </div>

            {annotations.length === 0 ? (
              <div className="pdf-viewer-quiet">
                {annotationLoading ? "Checking for annotations..." : "No annotations yet."}
              </div>
            ) : (
              <div className="pdf-viewer-annotation-list">
                {annotations.map((annotation, index) => (
                  <button
                    key={annotation.id || `${annotation.pageNumber || "note"}-${index}`}
                    type="button"
                    className="pdf-viewer-annotation-item"
                    onClick={() => {
                      if (annotation.pageNumber) {
                        setPageNumber(clampPage(annotation.pageNumber, numPages));
                      }
                    }}
                  >
                    <div className="pdf-viewer-annotation-meta">
                      {annotation.pageNumber ? `Page ${annotation.pageNumber}` : "General"}
                      {annotation.author ? ` - ${annotation.author}` : ""}
                    </div>
                    <div className="pdf-viewer-annotation-text">
                      {annotation.content || "Open note"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
