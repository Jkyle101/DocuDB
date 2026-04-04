import "../utils/pdfCompat";
import React, { useEffect, useMemo, useState } from "react";
import PdfViewer from "./PdfViewer";
import {
  getFileExtension,
  isAudioFile,
  isImageFile,
  isOfficeDocument,
  isPdfFile,
  isTextLikeFile,
  isVideoFile,
} from "../utils/fileType";
import "./UniversalDocViewer.css";

const completeLoader = ({ fileLoaderComplete }) => {
  fileLoaderComplete();
};

function createFrameRenderer(fileTypes) {
  const FrameRenderer = ({ mainState }) => {
    const currentDocument = mainState.currentDocument;
    if (!currentDocument) return null;

    return (
      <div className="universal-doc-viewer-shell">
        <div className="universal-doc-viewer-frame">
          <iframe
            src={currentDocument.uri}
            title={currentDocument.title || "Document preview"}
          />
        </div>
      </div>
    );
  };

  FrameRenderer.fileTypes = fileTypes;
  FrameRenderer.weight = 20;
  FrameRenderer.fileLoader = completeLoader;

  return FrameRenderer;
}

function createImageRenderer(fileTypes) {
  const ImageRenderer = ({ mainState }) => {
    const currentDocument = mainState.currentDocument;
    if (!currentDocument) return null;

    return (
      <div className="universal-doc-viewer-shell">
        <div className="universal-doc-viewer-media">
          <img src={currentDocument.uri} alt={currentDocument.title || "Preview"} />
        </div>
      </div>
    );
  };

  ImageRenderer.fileTypes = fileTypes;
  ImageRenderer.weight = 20;
  ImageRenderer.fileLoader = completeLoader;

  return ImageRenderer;
}

function createVideoRenderer(fileTypes) {
  const VideoRenderer = ({ mainState }) => {
    const currentDocument = mainState.currentDocument;
    if (!currentDocument) return null;

    return (
      <div className="universal-doc-viewer-shell">
        <div className="universal-doc-viewer-media">
          <video src={currentDocument.uri} controls>
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    );
  };

  VideoRenderer.fileTypes = fileTypes;
  VideoRenderer.weight = 20;
  VideoRenderer.fileLoader = completeLoader;

  return VideoRenderer;
}

function createAudioRenderer(fileTypes) {
  const AudioRenderer = ({ mainState }) => {
    const currentDocument = mainState.currentDocument;
    if (!currentDocument) return null;

    return (
      <div className="universal-doc-viewer-shell">
        <div className="universal-doc-viewer-audio">
          <audio src={currentDocument.uri} controls>
            Your browser does not support the audio tag.
          </audio>
        </div>
      </div>
    );
  };

  AudioRenderer.fileTypes = fileTypes;
  AudioRenderer.weight = 20;
  AudioRenderer.fileLoader = completeLoader;

  return AudioRenderer;
}

const PdfRenderer = ({ mainState }) => {
  const currentDocument = mainState.currentDocument;
  if (!currentDocument) return null;

  return (
    <PdfViewer
      fileUrl={currentDocument.uri}
      title={currentDocument.title || "PDF document"}
      annotations={currentDocument.annotations || []}
      annotationLoading={Boolean(currentDocument.annotationLoading)}
      showAnnotationPane={Boolean(currentDocument.showAnnotationPane)}
      minHeight={currentDocument.minHeight || 560}
    />
  );
};

PdfRenderer.fileTypes = ["pdf", "application/pdf"];
PdfRenderer.weight = 30;
PdfRenderer.fileLoader = completeLoader;

const FrameRenderer = createFrameRenderer([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "md",
  "csv",
  "json",
  "xml",
  "html",
  "htm",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ImageRenderer = createImageRenderer([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/bmp",
  "image/webp",
]);

const VideoRenderer = createVideoRenderer([
  "mp4",
  "webm",
  "mov",
  "avi",
  "mkv",
  "m4v",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
]);

const AudioRenderer = createAudioRenderer([
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "aac",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
]);

const CUSTOM_RENDERERS = [PdfRenderer, FrameRenderer, ImageRenderer, VideoRenderer, AudioRenderer];

function buildViewerDocument({
  file,
  viewUrl,
  previewUrl,
  annotations,
  annotationLoading,
  showAnnotationPane,
  minHeight,
}) {
  const mime = String(file?.mimetype || "").toLowerCase();
  const ext = getFileExtension(file).replace(/^\./, "");
  const fileType = mime || ext || "txt";
  const title = file?.originalName || "Document";

  if (isPdfFile(file)) {
    return {
      uri: viewUrl,
      fileType: "application/pdf",
      title,
      annotations,
      annotationLoading,
      showAnnotationPane,
      minHeight,
    };
  }

  if (isImageFile(file) || isAudioFile(file) || isVideoFile(file)) {
    return {
      uri: viewUrl,
      fileType,
      title,
      minHeight,
    };
  }

  if (isOfficeDocument(file) || isTextLikeFile(file)) {
    return {
      uri: previewUrl,
      fileType,
      title,
      minHeight,
    };
  }

  return null;
}

export default function UniversalDocViewer({
  file,
  viewUrl,
  previewUrl,
  annotations = [],
  annotationLoading = false,
  showAnnotationPane = false,
  minHeight = 560,
  className = "",
}) {
  const [DocViewerComponent, setDocViewerComponent] = useState(null);
  const [viewerFailed, setViewerFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    setViewerFailed(false);

    import("react-doc-viewer")
      .then((module) => {
        if (isMounted) {
          setDocViewerComponent(() => module.default);
        }
      })
      .catch((error) => {
        console.error("Failed to load react-doc-viewer:", error);
        if (isMounted) {
          setViewerFailed(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const documents = useMemo(() => {
    const document = buildViewerDocument({
      file,
      viewUrl,
      previewUrl,
      annotations,
      annotationLoading,
      showAnnotationPane,
      minHeight,
    });

    return document ? [document] : [];
  }, [
    annotationLoading,
    annotations,
    file,
    minHeight,
    previewUrl,
    showAnnotationPane,
    viewUrl,
  ]);

  if (!documents.length) return null;
  if (viewerFailed) {
    const currentDocument = documents[0];

    if (isPdfFile(file)) {
      return (
        <PdfViewer
          fileUrl={currentDocument.uri}
          title={currentDocument.title || "PDF document"}
          annotations={currentDocument.annotations || []}
          annotationLoading={Boolean(currentDocument.annotationLoading)}
          showAnnotationPane={Boolean(currentDocument.showAnnotationPane)}
          minHeight={currentDocument.minHeight || minHeight}
        />
      );
    }

    if (isImageFile(file)) {
      return (
        <div className="universal-doc-viewer-shell">
          <div className="universal-doc-viewer-media">
            <img src={currentDocument.uri} alt={currentDocument.title || "Preview"} />
          </div>
        </div>
      );
    }

    if (isVideoFile(file)) {
      return (
        <div className="universal-doc-viewer-shell">
          <div className="universal-doc-viewer-media">
            <video src={currentDocument.uri} controls>
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      );
    }

    if (isAudioFile(file)) {
      return (
        <div className="universal-doc-viewer-shell">
          <div className="universal-doc-viewer-audio">
            <audio src={currentDocument.uri} controls>
              Your browser does not support the audio tag.
            </audio>
          </div>
        </div>
      );
    }

    return (
      <div className="universal-doc-viewer-shell">
        <div className="universal-doc-viewer-frame">
          <iframe
            src={currentDocument.uri}
            title={currentDocument.title || "Document preview"}
          />
        </div>
      </div>
    );
  }

  if (!DocViewerComponent) {
    return (
      <div
        className={`universal-doc-viewer ${className}`.trim()}
        style={{ "--universal-doc-viewer-min-height": `${minHeight}px` }}
      >
        <div className="universal-doc-viewer-shell">
          <div className="universal-doc-viewer-frame">
            <div className="pdf-viewer-loading">
              <div className="spinner-border" role="status" aria-hidden="true" />
              <span>Loading document viewer...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`universal-doc-viewer ${className}`.trim()}
      style={{ "--universal-doc-viewer-min-height": `${minHeight}px` }}
    >
      <DocViewerComponent
        documents={documents}
        pluginRenderers={CUSTOM_RENDERERS}
        config={{
          header: {
            disableHeader: true,
            disableFileName: true,
            retainURLParams: true,
          },
        }}
        theme={{
          primary: "#2563eb",
          secondary: "transparent",
          tertiary: "transparent",
          text_primary: "#0f172a",
          text_secondary: "#64748b",
          text_tertiary: "#64748b",
          disableThemeScrollbar: false,
        }}
      />
    </div>
  );
}
