import React from "react";
import {
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaCloudUploadAlt,
  FaExclamationCircle,
  FaTimes,
} from "react-icons/fa";
import "./upload-tray.css";

const getTaskIcon = (status) => {
  if (status === "success") return <FaCheckCircle />;
  if (status === "error") return <FaExclamationCircle />;
  if (status === "canceled") return <FaTimes />;
  return <FaCloudUploadAlt />;
};

export default function UploadTray({
  tasks,
  collapsed,
  hidden,
  onToggleCollapsed,
  onHide,
  onShow,
  onCancelTask,
  onDismissTask,
  onClearCompleted,
}) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  const activeTasks = tasks.filter((task) => task.status === "uploading");
  const completedTasks = tasks.filter((task) => task.status !== "uploading");

  if (hidden) {
    return (
      <button type="button" className="upload-tray-chip" onClick={onShow}>
        <FaCloudUploadAlt />
        <span>{activeTasks.length > 0 ? `Uploading ${activeTasks.length}` : `Uploads ${tasks.length}`}</span>
      </button>
    );
  }

  return (
    <aside className="upload-tray" aria-live="polite" aria-label="Upload progress">
      <div className="upload-tray__header">
        <div>
          <strong>{activeTasks.length > 0 ? `Uploading ${activeTasks.length} item${activeTasks.length === 1 ? "" : "s"}` : "Recent uploads"}</strong>
          <div className="upload-tray__header-subtitle">
            {activeTasks.length > 0
              ? "Uploads keep running in the background."
              : `${completedTasks.length} completed item${completedTasks.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="upload-tray__header-actions">
          {completedTasks.length > 0 && (
            <button type="button" className="upload-tray__link-btn" onClick={onClearCompleted}>
              Clear
            </button>
          )}
          <button
            type="button"
            className="upload-tray__icon-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
          >
            {collapsed ? <FaChevronUp /> : <FaChevronDown />}
          </button>
          <button
            type="button"
            className="upload-tray__icon-btn"
            onClick={onHide}
            aria-label="Hide upload tray"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="upload-tray__list">
          {tasks.map((task) => (
            <div key={task.id} className={`upload-tray__item is-${task.status}`}>
              <div className="upload-tray__item-icon">{getTaskIcon(task.status)}</div>
              <div className="upload-tray__item-body">
                <div className="upload-tray__item-name" title={task.name}>
                  {task.name}
                </div>
                <div className="upload-tray__item-status">{task.statusText || "Uploading..."}</div>
                {task.detail && (
                  <div className="upload-tray__item-detail" title={task.detail}>
                    {task.detail}
                  </div>
                )}
                {task.status === "uploading" && (
                  <div className="upload-tray__progress" role="progressbar" aria-valuenow={Math.round(task.progress || 0)} aria-valuemin="0" aria-valuemax="100">
                    <div className="upload-tray__progress-bar" style={{ width: `${Math.round(task.progress || 0)}%` }} />
                  </div>
                )}
              </div>
              <div className="upload-tray__item-side">
                {task.status === "uploading" ? (
                  <>
                    <span className="upload-tray__item-percent">{Math.round(task.progress || 0)}%</span>
                    <button
                      type="button"
                      className="upload-tray__link-btn"
                      onClick={() => onCancelTask(task.id)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="upload-tray__link-btn"
                    onClick={() => onDismissTask(task.id)}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
