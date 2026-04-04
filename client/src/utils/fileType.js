export function isPdfFile(file) {
  const mime = String(file?.mimetype || file?.type || "").toLowerCase();
  const name = String(file?.originalName || file?.name || file?.filename || "").toLowerCase();

  return mime.includes("pdf") || name.endsWith(".pdf");
}

export function getFileExtension(file) {
  const name = String(file?.originalName || file?.name || file?.filename || "").toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex) : "";
}

export function isImageFile(file) {
  const mime = String(file?.mimetype || file?.type || "").toLowerCase();
  const ext = getFileExtension(file);
  return mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext);
}

export function isVideoFile(file) {
  const mime = String(file?.mimetype || file?.type || "").toLowerCase();
  const ext = getFileExtension(file);
  return mime.startsWith("video/") || [".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"].includes(ext);
}

export function isAudioFile(file) {
  const mime = String(file?.mimetype || file?.type || "").toLowerCase();
  const ext = getFileExtension(file);
  return mime.startsWith("audio/") || [".mp3", ".wav", ".ogg", ".m4a", ".aac"].includes(ext);
}

export function isOfficeDocument(file) {
  const mime = String(file?.mimetype || file?.type || "").toLowerCase();
  const ext = getFileExtension(file);
  return (
    mime.includes("wordprocessingml") ||
    mime.includes("spreadsheetml") ||
    mime.includes("vnd.ms-excel") ||
    mime.includes("presentationml") ||
    mime === "application/msword" ||
    mime === "application/vnd.ms-powerpoint" ||
    [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"].includes(ext)
  );
}

export function isTextLikeFile(file) {
  const mime = String(file?.mimetype || file?.type || "").toLowerCase();
  const ext = getFileExtension(file);
  return (
    mime.startsWith("text/") ||
    ["application/json", "application/xml", "text/csv", "application/csv"].includes(mime) ||
    [".txt", ".md", ".json", ".xml", ".csv", ".html", ".htm"].includes(ext)
  );
}
