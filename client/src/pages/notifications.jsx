import React, { useState, useEffect } from "react";
import { FaBell, FaShareAlt, FaComment, FaKey, FaFile, FaFolder, FaUsers, FaCheckCircle, FaTimesCircle, FaClock, FaEye, FaExclamationTriangle } from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config";

const normalizeRole = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw === "admin") return "superadmin";
  if (raw === "user") return "faculty";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  if (raw === "reviewer") return "evaluator";
  return raw;
};

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId");
  const userRole = normalizeRole(localStorage.getItem("role") || "faculty");

  useEffect(() => {
    fetchNotifications();

    // Set up polling for real-time updates every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/notifications/${userId}`);
      const payload = Array.isArray(response.data)
        ? response.data
        : (Array.isArray(response.data?.notifications) ? response.data.notifications : []);
      setNotifications(payload);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`${BACKEND_URL}/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      return true;
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`${BACKEND_URL}/notifications/${userId}/read-all`);
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const getNotificationIcon = (type) => {
    const normalized = String(type || "").toUpperCase();
    if (normalized.includes("SHARE")) return <FaShareAlt className="text-primary" />;
    if (normalized.includes("COMMENT")) return <FaComment className="text-info" />;
    if (normalized.includes("PASSWORD")) return <FaKey className="text-warning" />;
    if (normalized.includes("GROUP")) return <FaUsers className="text-success" />;
    if (normalized.includes("APPROVED")) return <FaCheckCircle className="text-success" />;
    if (normalized.includes("REJECTED") || normalized.includes("REMOVED")) return <FaTimesCircle className="text-danger" />;
    if (normalized.includes("UPLOAD") || normalized.includes("FILE")) return <FaFile className="text-secondary" />;
    if (normalized.includes("FOLDER")) return <FaFolder className="text-warning" />;
    if (
      normalized.includes("ACTION") ||
      normalized.includes("REVIEW") ||
      normalized.includes("REQUEST") ||
      normalized.includes("ALERT") ||
      normalized.includes("COPC") ||
      normalized.includes("WELCOME")
    ) {
      return <FaExclamationTriangle className="text-warning" />;
    }
    return <FaBell className="text-muted" />;
  };

  const getNotificationSummary = (notification) => {
    const actor = notification?.actorId;
    const actorLabel = actor?.name || actor?.email || "";
    const title = notification?.title || "Notification";
    const message = notification?.message || notification?.details || "You have a new notification.";
    const details = notification?.details ? String(notification.details).trim() : "";
    const actorPrefix = actorLabel && !message.includes(actorLabel) ? `${actorLabel}: ` : "";
    return {
      title,
      message: `${actorPrefix}${message}`,
      details,
    };
  };

  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "string" || typeof value === "number") {
      return String(value).trim();
    }
    if (typeof value === "object") {
      return String(value._id || value.id || "").trim();
    }
    return "";
  };

  const appendQuery = (basePath, params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const normalized = String(value || "").trim();
      if (normalized) search.set(key, normalized);
    });
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const getNotificationTargetPath = (notification) => {
    const type = String(notification?.type || "").toUpperCase();
    const title = String(notification?.title || "").toLowerCase();
    const message = String(notification?.message || "").toLowerCase();
    const details = String(notification?.details || "").toLowerCase();
    const combinedText = `${title} ${message} ${details}`;
    const relatedModel = String(notification?.relatedModel || "").toLowerCase();
    const relatedId = normalizeId(notification?.relatedId);
    const metadata =
      notification?.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
        ? notification.metadata
        : {};

    const metadataTargetPath = String(metadata?.targetPath || "").trim();
    if (metadataTargetPath) return metadataTargetPath;

    const metadataProgramId = normalizeId(metadata?.programId || metadata?.copcProgramId || metadata?.rootProgramId);
    const metadataFolderId = normalizeId(metadata?.folderId);
    const metadataFileId = normalizeId(metadata?.fileId);
    const metadataTaskId = normalizeId(metadata?.taskId);

    const programId =
      metadataProgramId ||
      (relatedModel === "folder" && (type.startsWith("COPC_") || type === "DOCUMENT_REQUEST") ? relatedId : "");
    const folderId = metadataFolderId || (relatedModel === "folder" ? relatedId : "");
    const fileId = metadataFileId || (relatedModel === "file" ? relatedId : "");

    const copcBasePath = userRole === "superadmin" ? "/admin/copc-dashboard" : "/copc-dashboard";
    const buildCopcPath = (tab = "workflow") =>
      appendQuery(copcBasePath, {
        tab,
        programId,
      });
    const buildUploadPath = () =>
      appendQuery("/copc-workflow/upload", {
        programId,
        folderId,
      });
    const buildTaskPath = () => {
      if (userRole === "superadmin") {
        return appendQuery("/admin/tasks", {
          tab: "task_management",
          programId,
          folderId,
        });
      }
      const tab = userRole === "dept_chair" ? "task_management" : "tasks";
      return buildCopcPath(tab);
    };

    const hasQaSignal = combinedText.includes("qa");
    const hasDeptSignal = combinedText.includes("department") || combinedText.includes("chair review");
    const hasEvaluationSignal = combinedText.includes("evaluation");
    const hasTaskSignal = !!metadataTaskId || combinedText.includes("task");
    const hasUploadSignal = combinedText.includes("upload");
    const hasCopcSignal = combinedText.includes("copc") || combinedText.includes("workflow");

    if (type === "WELCOME") return "/";

    if (type === "PASSWORD_CHANGE_REQUEST") return "/admin/manageusers";
    if (type === "PASSWORD_CHANGE_APPROVED" || type === "PASSWORD_CHANGE_REJECTED") return "/settings";

    if (type === "SHARE_FILE" || type === "SHARE_FOLDER") return "/shared";
    if (type === "FILE_UPDATED") return fileId ? `/editor/${fileId}` : "/shared";

    if (type === "COMMENT") {
      if (fileId) return `/editor/${fileId}`;
      return "/shared";
    }

    if (type.startsWith("GROUP_") || relatedModel === "group") return "/groups";

    if (type === "DOCUMENT_REQUEST") return buildUploadPath();
    if (type === "DEADLINE_ALERT") return buildTaskPath();
    if (type === "DUPLICATE_ALERT") return "/recent";

    if (type === "REVIEW_REQUIRED") {
      if (hasQaSignal) return buildCopcPath("qa_review");
      if (hasDeptSignal) return buildCopcPath("department_review");
      if (hasTaskSignal) return buildTaskPath();
      return buildCopcPath("workflow");
    }

    if (type === "ACTION_REQUIRED") {
      if (hasTaskSignal) return buildTaskPath();
      if (hasUploadSignal) return buildUploadPath();
      if (hasQaSignal) return buildCopcPath("qa_review");
      if (hasDeptSignal) return buildCopcPath("department_review");
      if (hasEvaluationSignal) return buildCopcPath("evaluation");
      if (hasCopcSignal || folderId || programId) return buildCopcPath("workflow");
    }

    if (type === "COPC_REVIEW_APPROVED" || type === "COPC_REVIEW_REJECTED") return buildCopcPath("workflow");
    if (type === "COPC_OBSERVATION" || type === "COPC_WORKFLOW_ACTION") return buildCopcPath("workflow");

    if (fileId) return `/editor/${fileId}`;
    if (folderId && hasCopcSignal) return buildCopcPath("workflow");
    if (folderId) return "/shared";
    return "/";
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?._id) return;
    const targetPath = getNotificationTargetPath(notification);
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    if (targetPath) {
      navigate(targetPath);
    }
  };

  const matchesFilter = (notification) => {
    const normalized = String(notification?.type || "").toLowerCase();
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.isRead;
    if (activeFilter === "share") return normalized.includes("share");
    if (activeFilter === "comment") return normalized.includes("comment");
    if (activeFilter === "password") return normalized.includes("password");
    if (activeFilter === "group") return normalized.includes("group");
    if (activeFilter === "action") {
      return (
        normalized.includes("action") ||
        normalized.includes("review") ||
        normalized.includes("request") ||
        normalized.includes("alert") ||
        normalized.includes("copc")
      );
    }
    return true;
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(matchesFilter);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">
              <FaBell className="me-2 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="badge bg-danger ms-2">{unreadCount}</span>
              )}
            </h2>
            {unreadCount > 0 && (
              <button
                className="btn btn-outline-primary"
                onClick={markAllAsRead}
              >
                <FaEye className="me-1" />
                Mark All as Read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All", icon: FaBell },
                  { key: "unread", label: "Unread", icon: FaEye },
                  { key: "share", label: "Shares", icon: FaShareAlt },
                  { key: "comment", label: "Comments", icon: FaComment },
                  { key: "password", label: "Password", icon: FaKey },
                  { key: "group", label: "Groups", icon: FaUsers }
                  ,
                  { key: "action", label: "Action", icon: FaExclamationTriangle }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    className={`btn ${activeFilter === key ? 'btn-primary' : 'btn-outline-primary'} btn-sm`}
                    onClick={() => setActiveFilter(key)}
                  >
                    <Icon className="me-1" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="card shadow-sm">
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 text-muted">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-5">
                  <FaBell className="text-muted mb-3" size={48} />
                  <h5 className="text-muted">No notifications</h5>
                  <p className="text-muted">
                    {activeFilter === "all"
                      ? "You're all caught up! No notifications yet."
                      : `No ${activeFilter} notifications found.`
                    }
                  </p>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {filteredNotifications.map((notification) => (
                    (() => {
                      const summary = getNotificationSummary(notification);
                      const targetPath = getNotificationTargetPath(notification);
                      const isClickable = !!targetPath;
                      return (
                    <div
                      key={notification._id}
                      className={`list-group-item d-flex align-items-start p-3 ${
                        !notification.isRead ? 'bg-light' : ''
                      }`}
                      style={{ cursor: isClickable ? 'pointer' : 'default' }}
                      onClick={() => isClickable && handleNotificationClick(notification)}
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : -1}
                      onKeyDown={(e) => {
                        if (!isClickable) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleNotificationClick(notification);
                        }
                      }}
                    >
                      {/* Icon */}
                      <div className="me-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="fw-semibold mb-1">{summary.title}</div>
                            <p className="mb-1">
                              {summary.message}
                            </p>
                            {summary.details && (
                              <div className="small text-muted mb-1">{summary.details}</div>
                            )}
                            <small className="text-muted d-flex align-items-center">
                              <FaClock className="me-1" size={10} />
                              {getTimeAgo(notification.createdAt || notification.date)}
                              {!notification.isRead && (
                                <span className="badge bg-primary ms-2">New</span>
                              )}
                            </small>
                          </div>

                          {/* Mark as Read Button */}
                          {!notification.isRead && (
                            <button
                              className="btn btn-sm btn-outline-secondary ms-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification._id);
                              }}
                              title="Mark as read"
                            >
                              <FaEye size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                      );
                    })()
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Notifications;
