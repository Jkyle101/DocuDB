import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { BACKEND_URL } from "../config";
import { useUploadManager } from "../context/UploadManagerContext";
import {
  buildCopcFilename,
  buildCopcFilenameFromServerError,
  isCopcNamingError,
  renameFileForCopc,
  renameFileWithName,
} from "../utils/copcFilename";

const normalizeNameKey = (value = "") => String(value || "").trim().toLowerCase();

const splitFileNameParts = (value = "") => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(.*?)(\.[^.]+)?$/);
  return {
    basename: match?.[1] || raw || "Untitled",
    extension: match?.[2] || "",
  };
};

const buildKeepBothName = (fileName, existingNames) => {
  const taken = new Set((existingNames || []).map((name) => normalizeNameKey(name)));
  const { basename, extension } = splitFileNameParts(fileName);
  let counter = 1;
  let candidate = `${basename} (${counter})${extension}`;
  while (taken.has(normalizeNameKey(candidate))) {
    counter += 1;
    candidate = `${basename} (${counter})${extension}`;
  }
  return candidate;
};

const buildSpeedLabel = (loaded, lastLoaded, now, lastTs) => {
  const deltaBytes = Math.max(0, loaded - (lastLoaded || 0));
  const deltaMs = Math.max(1, now - (lastTs || now));
  const speedMBps = (deltaBytes / 1024 / 1024) / (deltaMs / 1000);
  return `${speedMBps.toFixed(2)} MB/s`;
};

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
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);
  const [duplicateChoice, setDuplicateChoice] = useState("replace_existing");
  const speedRef = useRef({ lastLoaded: 0, lastTs: 0 });
  const { startTrackedTask } = useUploadManager();

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const isSecureContextForCamera =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const copcNamingExample = "COT_Area04_IT_Lab_Inventory_2026-03-19.pdf";
  const fileInputAccept = isCopcContext
    ? ".pdf"
    : ".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg";

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
        const userId = localStorage.getItem("userId");
        const role = localStorage.getItem("role");
        const { data } = await axios.get(`${BACKEND_URL}/folders/${parentFolder}`, {
          params: { userId, role },
        });
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

  useEffect(() => {
    if (!isCopcContext) return;
    setDesiredType("pdf");
  }, [isCopcContext]);

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

  const createUploadFormData = ({
    uploadFile,
    userId,
    role,
    parentId,
    isUpdate = false,
    fileId = "",
    changeDescription = "",
    duplicateAction = "",
  }) => {
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("userId", userId || "");
    formData.append("role", role || "user");
    if (parentId) formData.append("parentFolder", parentId);
    if (isUpdate) formData.append("isUpdate", "true");
    if (fileId) formData.append("fileId", fileId);
    if (changeDescription) formData.append("changeDescription", changeDescription);
    if (duplicateAction) formData.append("duplicateAction", duplicateAction);
    return formData;
  };

  const postUploadFile = async ({
    uploadFile,
    userId,
    role,
    parentId,
    isUpdate = false,
    fileId = "",
    changeDescription = "",
    duplicateAction = "",
    onUploadProgress,
    signal,
  }) => {
    const formData = createUploadFormData({
      uploadFile,
      userId,
      role,
      parentId,
      isUpdate,
      fileId,
      changeDescription,
      duplicateAction,
    });
    return axios.post(`${BACKEND_URL}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
      signal,
    });
  };

  const uploadWithCopcRetry = async ({
    sourceFile,
    userId,
    role,
    parentId,
    isUpdate = false,
    fileId = "",
    changeDescription = "",
    duplicateAction = "",
    onUploadProgress,
    signal,
  }) => {
    const initialFile = isCopcContext ? renameFileForCopc(sourceFile).file : sourceFile;
    try {
      return await postUploadFile({
        uploadFile: initialFile,
        userId,
        role,
        parentId,
        isUpdate,
        fileId,
        changeDescription,
        duplicateAction,
        onUploadProgress,
        signal,
      });
    } catch (err) {
      if (!isCopcContext || !isCopcNamingError(err)) throw err;
      const retryName = buildCopcFilenameFromServerError(
        err?.response?.data?.error,
        sourceFile?.name || initialFile?.name
      );
      const retryFile = renameFileWithName(sourceFile, retryName);
      return postUploadFile({
        uploadFile: retryFile,
        userId,
        role,
        parentId,
        isUpdate,
        fileId,
        changeDescription,
        duplicateAction,
        onUploadProgress,
        signal,
      });
    }
  };

  const findExistingFileConflict = async (nextName, folderId) => {
    const userId = localStorage.getItem("userId");
    const role = localStorage.getItem("role");
    const { data } = await axios.get(`${BACKEND_URL}/files`, {
      params: {
        userId,
        role,
        parentFolder: folderId || "",
      },
    });
    const rows = Array.isArray(data) ? data : [];
    const nameKey = normalizeNameKey(nextName);
    const existingFile = rows.find((row) => normalizeNameKey(row?.originalName) === nameKey) || null;
    return {
      existingFile,
      existingNames: rows.map((row) => row?.originalName).filter(Boolean),
    };
  };

  const queueSingleUpload = ({
    sourceFile,
    duplicateAction = "",
    existingFile = null,
  }) => {
    const userId = localStorage.getItem("userId");
    const role = localStorage.getItem("role");
    const preparedFile = isCopcContext ? renameFileForCopc(sourceFile).file : sourceFile;
    const nextTaskName = preparedFile?.name || sourceFile?.name || "Untitled file";
    const replacingExisting = duplicateAction === "replace_existing";

    startTrackedTask(
      {
        name: nextTaskName,
        detail: replacingExisting
          ? `Replacing ${existingFile?.originalName || nextTaskName}`
          : "Uploading to your selected location",
        statusText: replacingExisting ? "Replacing existing file..." : "Uploading file...",
        successText: replacingExisting ? "Uploaded as a new version" : "Upload complete",
        onSuccess: (result) => {
          if (typeof onUploaded === "function") {
            onUploaded(result?.file);
          }
        },
      },
      async (task) => {
        speedRef.current = { lastLoaded: 0, lastTs: Date.now() };
        const { data } = await uploadWithCopcRetry({
          sourceFile,
          userId,
          role,
          parentId: destinationFolder,
          isUpdate: replacingExisting,
          fileId: replacingExisting ? existingFile?._id : "",
          changeDescription: replacingExisting
            ? `Replaced existing file ${existingFile?.originalName || nextTaskName} via upload options`
            : "",
          duplicateAction,
          signal: task.signal,
          onUploadProgress: (evt) => {
            const loaded = evt.loaded || 0;
            const total = evt.total || preparedFile?.size || sourceFile?.size || 1;
            const now = Date.now();
            const previous = speedRef.current;
            const percent = Math.min(100, Math.max(0, (loaded / Math.max(total, 1)) * 100));
            const speedText = buildSpeedLabel(loaded, previous.lastLoaded, now, previous.lastTs);
            speedRef.current = { lastLoaded: loaded, lastTs: now };
            task.setProgress(percent, {
              statusText: replacingExisting ? "Replacing existing file..." : "Uploading file...",
              detail: `${Math.round(percent)}% • ${speedText}`,
            });
          },
        });

        return {
          file: data?.file,
          statusText: replacingExisting ? "Existing file updated with a new version" : "Upload complete",
          detail:
            duplicateAction === "keep_both" && data?.naming?.storedName && data.naming.storedName !== sourceFile?.name
              ? `Saved as ${data.naming.storedName}`
              : data?.duplicate?.status === "duplicate"
                ? "Duplicate content detected by the system"
                : "Ready in your drive",
        };
      }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please choose a file");
      return;
    }

    try {
      setUploadingSingle(true);
      const preparedFile = isCopcContext ? renameFileForCopc(file).file : file;
      const { existingFile, existingNames } = await findExistingFileConflict(
        preparedFile?.name || file.name,
        destinationFolder
      );

      if (existingFile) {
        setDuplicateChoice("replace_existing");
        setDuplicatePrompt({
          sourceFile: file,
          existingFile,
          preparedName: preparedFile?.name || file.name,
          keepBothName: buildKeepBothName(preparedFile?.name || file.name, existingNames),
        });
        setUploadingSingle(false);
        return;
      }

      queueSingleUpload({ sourceFile: file });
      setUploadingSingle(false);
      onClose();
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadingSingle(false);
      alert(err?.response?.data?.error || "Upload failed. Please check backend logs.");
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
      const itemsSnapshot = [...folderItems];
      const destinationSnapshot = destinationFolder || null;
      startTrackedTask(
        {
          name: `Folder upload (${itemsSnapshot.length} files)`,
          detail: "Preparing folder structure",
          statusText: "Preparing folder upload...",
          successText: "Folder upload complete",
          onSuccess: () => {
            if (typeof onUploaded === "function") {
              onUploaded();
            }
          },
        },
        async (task) => {
          const totalBytes = itemsSnapshot.reduce((sum, item) => sum + (item.file?.size || 0), 0);
          let completedBytes = 0;
          const folderMap = new Map();
          folderMap.set("", destinationSnapshot);

          const folderPaths = new Set();
          for (const item of itemsSnapshot) {
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
            task.setStatusText("Creating folders...");
            task.setDetail(folderPath);
            const segments = folderPath.split("/");
            const name = segments[segments.length - 1];
            const parentPath = segments.slice(0, -1).join("/");
            const parentId = folderMap.get(parentPath) || null;
            const { data } = await axios.post(`${BACKEND_URL}/folders`, {
              name,
              owner: userId,
              parentFolder: parentId,
            });
            folderMap.set(folderPath, data?.folder?._id || null);
          }

          for (let index = 0; index < itemsSnapshot.length; index += 1) {
            const item = itemsSnapshot[index];
            const relative = normalizeRelativePath(item.relativePath);
            const folderPath = relative.includes("/")
              ? relative.split("/").slice(0, -1).join("/")
              : "";
            const parentId = folderMap.get(folderPath) || destinationSnapshot || null;
            const preparedFile = isCopcContext ? renameFileForCopc(item.file).file : item.file;
            speedRef.current = { lastLoaded: 0, lastTs: Date.now() };

            await uploadWithCopcRetry({
              sourceFile: item.file,
              userId,
              role: role || "user",
              parentId,
              duplicateAction: "keep_both",
              signal: task.signal,
              onUploadProgress: (evt) => {
                const loadedCurrent = evt.loaded || 0;
                const total = totalBytes || completedBytes + (preparedFile?.size || item.file?.size || 1);
                const aggregateLoaded = completedBytes + loadedCurrent;
                const now = Date.now();
                const previous = speedRef.current;
                const percent = Math.min(100, Math.max(0, (aggregateLoaded / Math.max(total, 1)) * 100));
                const speedText = buildSpeedLabel(loadedCurrent, previous.lastLoaded, now, previous.lastTs);
                speedRef.current = { lastLoaded: loadedCurrent, lastTs: now };
                task.setProgress(percent, {
                  statusText: `Uploading ${index + 1}/${itemsSnapshot.length}`,
                  detail: `${relative} • ${speedText}`,
                });
              },
            });

            completedBytes += item.file?.size || 0;
          }

          return {
            statusText: "Folder upload complete",
            detail: `${itemsSnapshot.length} files uploaded`,
          };
        }
      );
      setFolderItems([]);
      setFolderProgressText("");
      setUploadingFolder(false);
      onClose();
    } catch (err) {
      console.error("Folder upload failed:", err);
      setUploadingFolder(false);
      alert(err?.response?.data?.error || "Folder upload failed. Please check logs and try again.");
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
    if (isCopcContext) {
      const seededName = originalName || captures[0]?.name || "CameraCapture";
      const normalizedName = buildCopcFilename(seededName);
      formData.append("originalName", normalizedName);
    } else if (originalName) {
      formData.append("originalName", originalName);
    }
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
      alert(err?.response?.data?.error || "Camera upload failed");
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const modalMarkup = (
    <>
      <div className="modal d-block app-modal-overlay" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered app-modal-dialog app-modal-dialog--wide">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Upload File or Folder</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
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
                accept={fileInputAccept}
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
              {isCopcContext && (
                <div className="alert alert-warning py-2 mt-2 mb-0">
                  <div className="small fw-semibold mb-1">COPC File Naming Rule</div>
                  <div className="small">
                    Format: <code>[College]_[Area#]_[DocName]_[Date].pdf</code>
                  </div>
                  <div className="small">
                    Example: <code>{copcNamingExample}</code>
                  </div>
                  <div className="small mt-1">
                    If your filename does not match this format, the system auto-corrects it during upload.
                  </div>
                </div>
              )}
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
                          disabled={isCopcContext}
                          onChange={(e) => setDesiredType(e.target.value)}
                        >
                          <option value="pdf">PDF</option>
                          <option value="docx">Word (DOCX)</option>
                          <option value="pptx">PowerPoint (PPTX)</option>
                          <option value="xlsx">Excel (XLSX)</option>
                        </select>
                        {isCopcContext && (
                          <div className="small text-muted mt-1">
                            COPC folders currently require PDF filename compliance.
                          </div>
                        )}
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
      {duplicatePrompt && (
        <div className="modal d-block app-modal-overlay" tabIndex="-1" role="dialog" aria-modal="true" style={{ zIndex: 2100 }}>
          <div className="modal-dialog modal-dialog-centered app-modal-dialog app-modal-dialog--compact">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Upload Options</h5>
                <button type="button" className="btn-close" onClick={() => setDuplicatePrompt(null)}></button>
              </div>
              <div className="modal-body">
                <p className="mb-3">
                  <strong>{duplicatePrompt.preparedName}</strong> already exists in this location.
                  Do you want to replace the existing file with a new version or keep both files?
                  Replacing the file keeps version history and existing sharing settings.
                </p>
                <div className="vstack gap-3">
                  <label className="d-flex align-items-start gap-3">
                    <input
                      type="radio"
                      name="duplicateChoice"
                      className="form-check-input mt-1"
                      checked={duplicateChoice === "replace_existing"}
                      onChange={() => setDuplicateChoice("replace_existing")}
                    />
                    <span>
                      <span className="d-block fw-semibold">Replace existing file</span>
                      <span className="small text-muted">
                        Upload this as the newest version of {duplicatePrompt.existingFile?.originalName || duplicatePrompt.preparedName}.
                      </span>
                    </span>
                  </label>
                  <label className="d-flex align-items-start gap-3">
                    <input
                      type="radio"
                      name="duplicateChoice"
                      className="form-check-input mt-1"
                      checked={duplicateChoice === "keep_both"}
                      onChange={() => setDuplicateChoice("keep_both")}
                    />
                    <span>
                      <span className="d-block fw-semibold">Keep both files</span>
                      <span className="small text-muted">
                        Save this upload as <strong>{duplicatePrompt.keepBothName}</strong>.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setDuplicatePrompt(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    queueSingleUpload({
                      sourceFile: duplicatePrompt.sourceFile,
                      duplicateAction: duplicateChoice,
                      existingFile: duplicatePrompt.existingFile,
                    });
                    setDuplicatePrompt(null);
                    setUploadingSingle(false);
                    onClose();
                  }}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalMarkup, document.body);
  }
  return modalMarkup;
}
