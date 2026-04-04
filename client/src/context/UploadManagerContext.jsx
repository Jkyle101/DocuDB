import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import UploadTray from "../components/UploadTray";

const UploadManagerContext = createContext(null);

const AUTO_DISMISS_MS = 6500;
const CANCEL_DISMISS_MS = 2500;

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

const getErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.message ||
  "Upload failed";

export function UploadManagerProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const controllersRef = useRef(new Map());
  const dismissTimersRef = useRef(new Map());
  const nextIdRef = useRef(1);

  const clearDismissTimer = useCallback((taskId) => {
    const timer = dismissTimersRef.current.get(taskId);
    if (timer) {
      window.clearTimeout(timer);
      dismissTimersRef.current.delete(taskId);
    }
  }, []);

  const updateTask = useCallback((taskId, patch) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const nextPatch = typeof patch === "function" ? patch(task) : patch;
        return { ...task, ...(nextPatch || {}) };
      })
    );
  }, []);

  const dismissTask = useCallback((taskId) => {
    clearDismissTimer(taskId);
    controllersRef.current.delete(taskId);
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, [clearDismissTimer]);

  const scheduleDismiss = useCallback((taskId, delayMs) => {
    clearDismissTimer(taskId);
    const timer = window.setTimeout(() => {
      dismissTask(taskId);
    }, delayMs);
    dismissTimersRef.current.set(taskId, timer);
  }, [clearDismissTimer, dismissTask]);

  const finalizeTask = useCallback((taskId, status, patch = {}, dismissAfterMs = 0) => {
    controllersRef.current.delete(taskId);
    updateTask(taskId, (task) => ({
      ...patch,
      status,
      progress: status === "success" ? 100 : clampPercent(patch.progress ?? task.progress),
      cancelable: false,
      finishedAt: Date.now(),
    }));
    if (dismissAfterMs > 0) {
      scheduleDismiss(taskId, dismissAfterMs);
    }
  }, [scheduleDismiss, updateTask]);

  const cancelTask = useCallback((taskId) => {
    const controller = controllersRef.current.get(taskId);
    if (controller) {
      controller.abort();
    }
    finalizeTask(taskId, "canceled", { statusText: "Canceled" }, CANCEL_DISMISS_MS);
  }, [finalizeTask]);

  const startTrackedTask = useCallback((options, runner) => {
    const {
      name,
      detail = "",
      kind = "upload",
      statusText = "Preparing upload...",
      successText = "Upload complete",
      onSuccess,
      onError,
    } = options || {};

    const taskId = `upload-${Date.now()}-${nextIdRef.current++}`;
    const controller = new AbortController();
    controllersRef.current.set(taskId, controller);

    setHidden(false);
    setCollapsed(false);
    setTasks((prev) => ([
      {
        id: taskId,
        name: name || "Untitled upload",
        detail,
        status: "uploading",
        statusText,
        progress: 0,
        kind,
        cancelable: true,
        createdAt: Date.now(),
      },
      ...prev,
    ]));

    const taskApi = {
      id: taskId,
      signal: controller.signal,
      controller,
      update: (patch) => updateTask(taskId, patch),
      setDetail: (nextDetail) => updateTask(taskId, { detail: nextDetail }),
      setStatusText: (nextStatusText) => updateTask(taskId, { statusText: nextStatusText }),
      setProgress: (nextPercent, extra = {}) =>
        updateTask(taskId, (task) => ({
          progress: clampPercent(nextPercent),
          status: "uploading",
          statusText: extra.statusText ?? task.statusText,
          detail: extra.detail ?? task.detail,
          ...extra,
        })),
    };

    Promise.resolve()
      .then(() => runner(taskApi))
      .then((result) => {
        finalizeTask(
          taskId,
          "success",
          {
            statusText: result?.statusText || successText,
            detail: result?.detail ?? "",
          },
          AUTO_DISMISS_MS
        );
        if (typeof onSuccess === "function") {
          onSuccess(result);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          finalizeTask(taskId, "canceled", { statusText: "Canceled" }, CANCEL_DISMISS_MS);
          return;
        }
        finalizeTask(taskId, "error", {
          statusText: "Upload failed",
          detail: getErrorMessage(error),
        });
        if (typeof onError === "function") {
          onError(error);
        }
      });

    return taskId;
  }, [finalizeTask, updateTask]);

  const clearCompleted = useCallback(() => {
    const activeIds = new Set();
    setTasks((prev) =>
      prev.filter((task) => {
        if (task.status === "uploading") {
          activeIds.add(task.id);
          return true;
        }
        clearDismissTimer(task.id);
        controllersRef.current.delete(task.id);
        return false;
      })
    );
    return activeIds;
  }, [clearDismissTimer]);

  useEffect(() => () => {
    dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    dismissTimersRef.current.clear();
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
  }, []);

  const contextValue = useMemo(() => ({
    tasks,
    collapsed,
    hidden,
    setCollapsed,
    setHidden,
    startTrackedTask,
    cancelTask,
    dismissTask,
    clearCompleted,
  }), [tasks, collapsed, hidden, startTrackedTask, cancelTask, dismissTask, clearCompleted]);

  return (
    <UploadManagerContext.Provider value={contextValue}>
      {children}
      <UploadTray
        tasks={tasks}
        collapsed={collapsed}
        hidden={hidden}
        onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        onHide={() => setHidden(true)}
        onShow={() => setHidden(false)}
        onCancelTask={cancelTask}
        onDismissTask={dismissTask}
        onClearCompleted={clearCompleted}
      />
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const context = useContext(UploadManagerContext);
  if (!context) {
    throw new Error("useUploadManager must be used within an UploadManagerProvider.");
  }
  return context;
}
