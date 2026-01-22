import React, { useState, useEffect } from "react";
import { FaBell, FaShareAlt, FaComment, FaKey, FaUser, FaFile, FaFolder, FaUsers, FaCheckCircle, FaTimesCircle, FaClock, FaEye } from "react-icons/fa";
import axios from "axios";
import { BACKEND_URL } from "../config";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  const userId = localStorage.getItem("userId");

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
      setNotifications(response.data || []);
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
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
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
    switch (type) {
      case "SHARE_FILE":
      case "SHARE_FOLDER":
        return <FaShareAlt className="text-primary" />;
      case "COMMENT":
        return <FaComment className="text-info" />;
      case "PASSWORD_CHANGE_REQUEST":
        return <FaKey className="text-warning" />;
      case "PASSWORD_CHANGE_APPROVED":
        return <FaCheckCircle className="text-success" />;
      case "PASSWORD_CHANGE_REJECTED":
        return <FaTimesCircle className="text-danger" />;
      case "GROUP_INVITE":
        return <FaUsers className="text-success" />;
      case "UPLOAD":
        return <FaFile className="text-secondary" />;
      case "CREATE_FOLDER":
        return <FaFolder className="text-warning" />;
      default:
        return <FaBell className="text-muted" />;
    }
  };

  const getNotificationMessage = (notification) => {
    const { type, details, user } = notification;

    switch (type) {
      case "SHARE_FILE":
        return `${user?.email || "Someone"} shared a file with you: ${details}`;
      case "SHARE_FOLDER":
        return `${user?.email || "Someone"} shared a folder with you: ${details}`;
      case "COMMENT":
        return `${user?.email || "Someone"} commented on your file: ${details}`;
      case "PASSWORD_CHANGE_REQUEST":
        return "Your password change request has been submitted for approval.";
      case "PASSWORD_CHANGE_APPROVED":
        return "Your password change request has been approved.";
      case "PASSWORD_CHANGE_REJECTED":
        return "Your password change request has been rejected.";
      case "GROUP_INVITE":
        return `${user?.email || "Someone"} invited you to join a group: ${details}`;
      case "UPLOAD":
        return `${user?.email || "Someone"} uploaded a new file: ${details}`;
      case "CREATE_FOLDER":
        return `${user?.email || "Someone"} created a new folder: ${details}`;
      default:
        return details || "You have a new notification.";
    }
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

  const filteredNotifications = notifications.filter(notification => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.isRead;
    return notification.type.toLowerCase().includes(activeFilter.toLowerCase());
  });

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
                    <div
                      key={notification._id}
                      className={`list-group-item d-flex align-items-start p-3 ${
                        !notification.isRead ? 'bg-light' : ''
                      }`}
                      style={{ cursor: !notification.isRead ? 'pointer' : 'default' }}
                      onClick={() => !notification.isRead && markAsRead(notification._id)}
                    >
                      {/* Icon */}
                      <div className="me-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <p className="mb-1">
                              {getNotificationMessage(notification)}
                            </p>
                            <small className="text-muted d-flex align-items-center">
                              <FaClock className="me-1" size={10} />
                              {getTimeAgo(notification.date)}
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
