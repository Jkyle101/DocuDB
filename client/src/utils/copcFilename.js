const COPC_FORMAT_REGEX =
  /^([A-Za-z0-9]+)_((?:Area)?\d{1,2})_([A-Za-z0-9][A-Za-z0-9_()&.\-]*)_((?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\.pdf$/i;
const COPC_DATE_REGEX =
  /((?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/;
const COPC_AREA_REGEX = /(?:^|_)(?:Area)?(\d{1,2})(?:_|$)/i;
const COPC_SAMPLE_REGEX =
  /([A-Za-z0-9]+_Area\d{2}_[A-Za-z0-9_()&.\-]+_(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\.pdf)/i;

function todayDateText() {
  return new Date().toISOString().slice(0, 10);
}

function toAreaToken(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return `Area${String(Math.floor(num)).padStart(2, "0")}`;
}

function parseCopcFilename(name) {
  const raw = String(name || "").trim();
  const match = raw.match(COPC_FORMAT_REGEX);
  if (!match) return null;

  const areaDigits = String(match[2]).match(/(\d{1,2})/);
  const areaToken = areaDigits?.[1] ? toAreaToken(Number(areaDigits[1])) : null;
  if (!areaToken) return null;

  return {
    collegeCode: String(match[1]).toUpperCase(),
    areaToken,
    docName: String(match[3]),
    dateText: String(match[4]),
  };
}

function normalizeCopcDocName(value) {
  const raw = String(value || "")
    .replace(/\.[^.]+$/, "")
    .trim();

  const normalized = raw
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Za-z0-9_()&.\-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "Document_Name";
}

function extractAreaToken(name) {
  const match = String(name || "").match(COPC_AREA_REGEX);
  const digits = Number(match?.[1]);
  if (!Number.isFinite(digits)) return null;
  return toAreaToken(digits);
}

function extractDateText(name) {
  const match = String(name || "").match(COPC_DATE_REGEX);
  return match?.[1] || todayDateText();
}

function extractDocNameSeed(rawName = "") {
  const baseWithoutExt = String(rawName || "").replace(/\.[^.]+$/, "");
  const tokens = baseWithoutExt.split("_").filter(Boolean);
  const lastToken = String(tokens[tokens.length - 1] || "");
  const secondToken = String(tokens[1] || "");
  const looksLikeDateToken = COPC_DATE_REGEX.test(lastToken);
  const looksLikeAreaToken = /^(?:Area)?\d{1,2}$/i.test(secondToken);

  if (tokens.length >= 4 && looksLikeDateToken && looksLikeAreaToken) {
    return tokens.slice(2, -1).join("_");
  }
  return baseWithoutExt;
}

export function renameFileWithName(file, nextName) {
  if (!file || !nextName) return file;
  if (String(file.name || "") === String(nextName)) return file;
  try {
    return new File([file], nextName, {
      type: file.type || "application/pdf",
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  }
}

export function buildCopcFilename(rawName, options = {}) {
  const parsed = parseCopcFilename(rawName);
  const docNameSeed = parsed?.docName || extractDocNameSeed(rawName);
  const docName = normalizeCopcDocName(docNameSeed);
  const collegeCode = String(
    parsed?.collegeCode || options.defaultCollege || "COT"
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "COT";
  const areaToken =
    parsed?.areaToken ||
    extractAreaToken(rawName) ||
    String(options.defaultAreaToken || "Area01");
  const dateText = parsed?.dateText || extractDateText(rawName);
  return `${collegeCode}_${areaToken}_${docName}_${dateText}.pdf`;
}

export function renameFileForCopc(file, options = {}) {
  if (!file) return { file, name: "", renamed: false };
  const nextName = buildCopcFilename(file.name, options);
  const renamedFile = renameFileWithName(file, nextName);
  return {
    file: renamedFile,
    name: nextName,
    renamed: String(renamedFile?.name || "") !== String(file?.name || ""),
  };
}

export function buildCopcFilenameFromServerError(errorMessage, fallbackName, options = {}) {
  const message = String(errorMessage || "");
  const sampleMatch = message.match(COPC_SAMPLE_REGEX);
  if (!sampleMatch?.[1]) {
    return buildCopcFilename(fallbackName, options);
  }

  const parsedSample = parseCopcFilename(sampleMatch[1]);
  if (!parsedSample) {
    return buildCopcFilename(fallbackName, options);
  }

  const docName = normalizeCopcDocName(extractDocNameSeed(fallbackName));
  return `${parsedSample.collegeCode}_${parsedSample.areaToken}_${docName}_${parsedSample.dateText}.pdf`;
}

export function isCopcNamingError(error) {
  const code = String(error?.response?.data?.code || error?.code || "").trim();
  if (code === "COPC_FILENAME_INVALID") return true;
  const message = String(error?.response?.data?.error || error?.message || "").toLowerCase();
  return message.includes("copc") && message.includes("naming");
}
