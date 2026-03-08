import axios from "axios";
import { BACKEND_URL } from "../config";

const normalizeRelativePath = (value = "") =>
  String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();

const filesFromInputList = (fileList) =>
  Array.from(fileList || [])
    .map((pickedFile) => {
      const relativePath = normalizeRelativePath(
        pickedFile.webkitRelativePath || pickedFile.relativePath || pickedFile.name
      );
      return relativePath ? { file: pickedFile, relativePath } : null;
    })
    .filter(Boolean);

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

export const isExternalFileDrag = (event) => {
  const types = Array.from(event?.dataTransfer?.types || []);
  return types.includes("Files");
};

export const extractDroppedEntries = async (dataTransfer) => {
  if (!dataTransfer) return [];
  const droppedFromItems = await filesFromDataTransferItems(dataTransfer.items);
  const rows =
    droppedFromItems.length > 0
      ? droppedFromItems
      : filesFromInputList(dataTransfer.files);
  return rows
    .map((item) => ({
      file: item.file,
      relativePath: normalizeRelativePath(
        item.relativePath || item.file?.webkitRelativePath || item.file?.name
      ),
    }))
    .filter((item) => item.file && item.relativePath);
};

export async function uploadDroppedEntries({
  dataTransfer,
  entries,
  destinationFolderId = null,
  userId,
  role,
  onStatus,
}) {
  if (!userId) throw new Error("Missing user session.");

  const droppedEntries = Array.isArray(entries) ? entries : await extractDroppedEntries(dataTransfer);
  if (!droppedEntries.length) {
    return { uploadedCount: 0, createdFolders: 0 };
  }

  const folderMap = new Map();
  folderMap.set("", destinationFolderId || null);

  const folderPaths = new Set();
  for (const item of droppedEntries) {
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

  let createdFolders = 0;
  for (const folderPath of sortedFolderPaths) {
    const segments = folderPath.split("/");
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/");
    const parentId = folderMap.get(parentPath) || null;

    if (typeof onStatus === "function") onStatus(`Creating folder: ${folderPath}`);
    const { data } = await axios.post(`${BACKEND_URL}/folders`, {
      name,
      owner: userId,
      role,
      parentFolder: parentId,
    });
    folderMap.set(folderPath, data?.folder?._id || null);
    createdFolders += 1;
  }

  let uploadedCount = 0;
  const total = droppedEntries.length;
  for (let i = 0; i < droppedEntries.length; i += 1) {
    const item = droppedEntries[i];
    const relative = normalizeRelativePath(item.relativePath);
    const folderPath = relative.includes("/") ? relative.split("/").slice(0, -1).join("/") : "";
    const parentId = folderMap.get(folderPath) || destinationFolderId || null;

    if (typeof onStatus === "function") {
      onStatus(`Uploading ${i + 1}/${total}: ${relative}`);
    }

    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("userId", userId);
    formData.append("role", role || "faculty");
    if (parentId) formData.append("parentFolder", parentId);

    await axios.post(`${BACKEND_URL}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    uploadedCount += 1;
  }

  if (typeof onStatus === "function") {
    onStatus(`Uploaded ${uploadedCount} file${uploadedCount === 1 ? "" : "s"}.`);
  }

  return { uploadedCount, createdFolders };
}
