import axios from "axios";
import { BACKEND_URL } from "../config";

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const toHealthStatus = (score, hasPending) => {
  if (score >= 90 && !hasPending) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 50) return "In Progress";
  return "Needs Attention";
};

export async function fetchCopcHealthSnapshot({
  userId,
  role,
  preferredProgramId = "",
  maxPrograms = 6,
}) {
  if (!userId) {
    return {
      score: 0,
      status: "No Session",
      note: "Sign in to load COPC metrics.",
      sampleCount: 0,
    };
  }

  const { data } = await axios.get(`${BACKEND_URL}/copc/programs`, {
    params: { userId, role },
  });
  const programs = Array.isArray(data) ? data : [];

  if (programs.length === 0) {
    return {
      score: 0,
      status: "No COPC Data",
      note: "No accessible COPC programs yet.",
      sampleCount: 0,
    };
  }

  const selectedId = String(preferredProgramId || "");
  const selectedProgram = selectedId
    ? programs.find((program) => String(program?._id) === selectedId)
    : null;

  const targets = selectedProgram
    ? [selectedProgram]
    : programs.slice(0, Math.max(1, Number(maxPrograms) || 6));

  const workflowResults = await Promise.allSettled(
    targets.map((program) =>
      axios.get(`${BACKEND_URL}/copc/programs/${program._id}/workflow`, {
        params: { userId, role },
      })
    )
  );

  const workflowRows = workflowResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value?.data)
    .filter(Boolean);

  if (workflowRows.length === 0) {
    return {
      score: 0,
      status: "Unavailable",
      note: "Unable to read workflow metrics right now.",
      sampleCount: 0,
    };
  }

  const totalCompliance = workflowRows.reduce(
    (sum, row) => sum + clampPercent(row?.overallCompliance || 0),
    0
  );
  const score = clampPercent(Math.round(totalCompliance / workflowRows.length));
  const hasPending = workflowRows.some(
    (row) =>
      Number(row?.counts?.pendingProgramChair || 0) > 0 ||
      Number(row?.counts?.pendingQa || 0) > 0 ||
      Number(row?.counts?.rejected || 0) > 0
  );
  const status = toHealthStatus(score, hasPending);

  const note = selectedProgram
    ? `${selectedProgram.programCode || selectedProgram.name}: live workflow metrics.`
    : `Average of ${workflowRows.length} accessible COPC program${workflowRows.length === 1 ? "" : "s"}.`;

  return {
    score,
    status,
    note,
    sampleCount: workflowRows.length,
  };
}

