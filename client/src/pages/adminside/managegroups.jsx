import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  FaUsers, FaPlus, FaEdit, FaTrash, FaShareAlt, FaBell, FaBullhorn,
  FaTimes, FaCheck, FaSearch, FaChartBar, FaCrown,
  FaUser, FaSync, FaInfoCircle, FaHistory,
  FaFileAlt, FaFolder
} from "react-icons/fa";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from "recharts";
import "bootstrap/dist/css/bootstrap.min.css";
import { BACKEND_URL } from "../../config";
import "./admin-analytics.css";
import "./managegroups-glass.css";

const getGroupAccentClass = (groupName, fallbackIndex) => {
  const normalizedTokens = String(groupName || "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  if (normalizedTokens.includes("COT")) return "is-cot";
  if (normalizedTokens.includes("COED")) return "is-coed";
  if (normalizedTokens.includes("COHTM")) return "is-cohtm";
  return ["is-ocean", "is-teal", "is-charcoal"][fallbackIndex % 3];
};

export default function ManageGroups() {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const REFRESH_INTERVAL_MS = 12000;

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "superadmin";

  useEffect(() => {
    refreshDashboard({ includeAssets: true });
  }, []);

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    return groups.filter(group =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groups, searchTerm]);

  // Prepare analytics data
  const groupStats = useMemo(() => {
    const totalMembers = groups.reduce((sum, group) => sum + (group.members?.length || 0), 0);
    const totalNotifications = groups.reduce((sum, group) => sum + (group.notifications?.length || 0), 0);
    const totalAnnouncements = groups.reduce((sum, group) => sum + (group.announcements?.length || 0), 0);

    return {
      totalGroups: groups.length,
      totalMembers,
      totalNotifications,
      totalAnnouncements,
      avgMembersPerGroup: groups.length > 0 ? (totalMembers / groups.length).toFixed(1) : 0
    };
  }, [groups]);

  // Activity data for charts
  const activityData = useMemo(() => {
    const activityTypes = [
      { name: 'Members', value: groupStats.totalMembers, color: '#8884d8' },
      { name: 'Notifications', value: groupStats.totalNotifications, color: '#82ca9d' },
      { name: 'Announcements', value: groupStats.totalAnnouncements, color: '#ffc658' }
    ];

    return activityTypes;
  }, [groupStats]);

  const sharedFilesCount = useMemo(
    () => groups.reduce((sum, group) => sum + (group.sharedFiles?.length || 0), 0),
    [groups]
  );
  const sharedFoldersCount = useMemo(
    () => groups.reduce((sum, group) => sum + (group.sharedFolders?.length || 0), 0),
    [groups]
  );
  const groupsWithLeaders = useMemo(
    () => groups.filter((group) => (group.leaders?.length || 0) > 0).length,
    [groups]
  );
  const leaderCoverage = groups.length > 0 ? ((groupsWithLeaders / groups.length) * 100).toFixed(0) : "0";
  const collaborationDensity = groupStats.totalGroups > 0
    ? ((groupStats.totalNotifications + groupStats.totalAnnouncements) / groupStats.totalGroups).toFixed(1)
    : "0.0";

  const refreshDashboard = async ({ silent = false, includeAssets = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [groupsRes, usersRes, filesRes, foldersRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/groups`),
        axios.get(`${BACKEND_URL}/users?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || "")}`),
        includeAssets
          ? axios.get(`${BACKEND_URL}/files`, { params: { role: "superadmin" } })
          : Promise.resolve(null),
        includeAssets
          ? axios.get(`${BACKEND_URL}/folders`, { params: { role: "superadmin" } })
          : Promise.resolve(null),
      ]);
      setGroups(groupsRes.data || []);
      setUsers(usersRes.data || []);
      if (filesRes) {
        setFiles(filesRes.data || []);
      }
      if (foldersRes) {
        setFolders(foldersRes.data || []);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to refresh groups dashboard:", err);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/groups`);
      setGroups(res.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/users?role=${encodeURIComponent(role)}`);
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchFilesAndFolders = async () => {
    try {
      const [filesRes, foldersRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/files`, { params: { role: "superadmin" } }),
        axios.get(`${BACKEND_URL}/folders`, { params: { role: "superadmin" } }),
      ]);
      setFiles(filesRes.data || []);
      setFolders(foldersRes.data || []);
    } catch (err) {
      console.error("Failed to fetch files/folders:", err);
    }
  };

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshDashboard({
          silent: true,
          includeAssets: activeTab === "shared" || showShareModal
        });
      }
    };

    const interval = setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [activeTab, showShareModal]);

  const handleCreateGroup = async (name, description) => {
    try {
      await axios.post(`${BACKEND_URL}/groups`, {
        name,
        description,
        createdBy: userId,
      });
      fetchGroups();
      setShowCreateModal(false);
    } catch (err) {
      console.error("Failed to create group:", err);
      alert("Failed to create group");
    }
  };

  const handleUpdateGroup = async (id, name, description) => {
    try {
      await axios.patch(`${BACKEND_URL}/groups/${id}`, { name, description });
      fetchGroups();
      setShowEditModal(false);
      setSelectedGroup(null);
    } catch (err) {
      console.error("Failed to update group:", err);
      alert("Failed to update group");
    }
  };

  const handleAddMembers = async (groupId, userIds) => {
    try {
      // Add members to group
      await axios.patch(`${BACKEND_URL}/groups/${groupId}/members`, { userIds, actorId: userId });
      console.log("Successfully added members to group");

      // Refresh groups data (non-blocking)
      try {
        await fetchGroups();
        console.log("Groups refreshed successfully");
      } catch (fetchErr) {
        console.warn("Failed to refresh groups after adding members:", fetchErr);
        // Don't show error for fetch failure
      }

      setShowMembersModal(false);
      setSelectedGroup(null);
      alert("Members added successfully!");
    } catch (err) {
      console.error("Failed to add members:", err);
      alert("Failed to add members. Please try again.");
    }
  };

  const handleRemoveMember = async (groupId, userId) => {
    if (!window.confirm("Remove this member from the group?")) return;
    try {
      // Remove member from group
      await axios.delete(`${BACKEND_URL}/groups/${groupId}/members/${userId}`, {
        data: { actorId: localStorage.getItem("userId") }
      });
      console.log("Successfully removed member from group");

      // Refresh groups data (non-blocking)
      try {
        await fetchGroups();
        console.log("Groups refreshed successfully");
      } catch (fetchErr) {
        console.warn("Failed to refresh groups after removing member:", fetchErr);
        // Don't show error for fetch failure
      }

      alert("Member removed successfully!");
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert("Failed to remove member. Please try again.");
    }
  };

  const handleToggleLeader = async (groupId, userId, action) => {
    try {
      await axios.patch(`${BACKEND_URL}/groups/${groupId}/leaders`, {
        userId,
        action,
        actorId: localStorage.getItem("userId")
      });
      fetchGroups();
      
      // Update selected group to reflect changes immediately in modal
      setSelectedGroup(prev => {
        if (!prev) return null;
        const newLeaders = action === "add" 
          ? [{ _id: userId }]
          : (prev.leaders || []).filter(l => l._id !== userId);
        return { ...prev, leaders: newLeaders };
      });
      
    } catch (err) {
      console.error("Failed to toggle leader:", err);
      alert("Failed to update leader status");
    }
  };

  const handleShareToGroup = async (groupId, type, itemId, permission) => {
    try {
      await axios.patch(`${BACKEND_URL}/groups/${groupId}/share`, {
        type,
        itemId,
        permission,
        sharedBy: userId,
      });
      alert(`Successfully shared ${type} to group`);
      setShowShareModal(false);
      setSelectedGroup(null);
      // Refresh groups data to reflect changes
      fetchGroups();
    } catch (err) {
      console.error("Failed to share:", err);
      const errorMessage = err.response?.data?.error || "Failed to share to group";
      alert(errorMessage);
    }
  };

  const handleAddNotification = async (groupId, title, message) => {
    try {
      await axios.post(`${BACKEND_URL}/groups/${groupId}/notifications`, {
        title,
        message,
        createdBy: userId,
      });
      fetchGroups();
      setShowNotificationModal(false);
      setSelectedGroup(null);
    } catch (err) {
      console.error("Failed to add notification:", err);
      alert("Failed to add notification");
    }
  };

  const handleAddAnnouncement = async (groupId, title, content) => {
    try {
      await axios.post(`${BACKEND_URL}/groups/${groupId}/announcements`, {
        title,
        content,
        createdBy: userId,
      });
      fetchGroups();
      setShowAnnouncementModal(false);
      setSelectedGroup(null);
    } catch (err) {
      console.error("Failed to add announcement:", err);
      alert("Failed to add announcement");
    }
  };

  const handleUnshareFromGroup = async (groupId, type, itemId) => {
    if (!window.confirm(`Remove this ${type} from the group?`)) return;
    try {
      await axios.patch(`${BACKEND_URL}/groups/${groupId}/unshare`, {
        type,
        itemId,
        userId,
      });
      alert(`${type} removed from group successfully`);
      fetchGroups(); // Refresh to show updated shared items
    } catch (err) {
      console.error("Failed to unshare:", err);
      alert("Failed to remove item from group");
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm("Delete this group?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/groups/${id}`);
      fetchGroups();
    } catch (err) {
      console.error("Failed to delete group:", err);
      alert("Failed to delete group");
    }
  };

  const activityTimeline = useMemo(() => {
    const events = groups.flatMap((group) => {
      const createdAt = new Date(group.createdAt || Date.now());
      const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
      const groupName = group.name || "Unnamed Group";
      const groupId = group._id;

      return [
        {
          id: `create-${groupId}`,
          type: "group_created",
          title: "Group Created",
          description: `"${groupName}" was created.`,
          timestamp: safeCreatedAt,
          group: groupName,
          groupId,
        },
        ...(group.members || []).map((member, index) => ({
          id: `member-${groupId}-${member?._id || index}`,
          type: "member_added",
          title: "Member Added",
          description: `${member?.email || member?.name || "A member"} joined "${groupName}".`,
          timestamp: safeCreatedAt,
          group: groupName,
          groupId,
        })),
        ...(group.sharedFiles || []).map((sharedFile, index) => ({
          id: `file-${groupId}-${sharedFile?.fileId?._id || sharedFile?._id || index}`,
          type: "file_shared",
          title: "File Shared",
          description: `"${sharedFile?.fileId?.originalName || "Unknown File"}" shared with "${groupName}".`,
          timestamp: new Date(sharedFile?.sharedAt || safeCreatedAt),
          group: groupName,
          groupId,
          details: `Permission: ${(sharedFile?.permission === "editor" || sharedFile?.permission === "write") ? "Editor" : "Viewer"}`,
        })),
        ...(group.sharedFolders || []).map((sharedFolder, index) => ({
          id: `folder-${groupId}-${sharedFolder?.folderId?._id || sharedFolder?._id || index}`,
          type: "folder_shared",
          title: "Folder Shared",
          description: `"${sharedFolder?.folderId?.name || "Unknown Folder"}" shared with "${groupName}".`,
          timestamp: new Date(sharedFolder?.sharedAt || safeCreatedAt),
          group: groupName,
          groupId,
          details: `Permission: ${(sharedFolder?.permission === "editor" || sharedFolder?.permission === "write") ? "Editor" : "Viewer"}`,
        })),
        ...(group.notifications || []).map((notification, index) => ({
          id: `notification-${groupId}-${index}`,
          type: "notification_added",
          title: "Notification Added",
          description: `"${notification?.title || "Notification"}" sent to "${groupName}".`,
          timestamp: new Date(notification?.createdAt || safeCreatedAt),
          group: groupName,
          groupId,
          details: notification?.message || "",
        })),
        ...(group.announcements || []).map((announcement, index) => ({
          id: `announcement-${groupId}-${index}`,
          type: "announcement_added",
          title: "Announcement Added",
          description: `"${announcement?.title || "Announcement"}" posted to "${groupName}".`,
          timestamp: new Date(announcement?.createdAt || safeCreatedAt),
          group: groupName,
          groupId,
          details: announcement?.content || "",
        })),
      ];
    });

    return events
      .map((event) => {
        const normalized = new Date(event.timestamp || Date.now());
        return {
          ...event,
          timestamp: Number.isNaN(normalized.getTime()) ? new Date() : normalized,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [groups]);

  const filteredActivityTimeline = useMemo(() => {
    if (!searchTerm.trim()) return activityTimeline;
    const visibleGroupIds = new Set(filteredGroups.map((group) => String(group._id)));
    return activityTimeline.filter((activity) => visibleGroupIds.has(String(activity.groupId)));
  }, [activityTimeline, filteredGroups, searchTerm]);

  const weeklyVolumeData = useMemo(() => {
    const dayBuckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    activityTimeline.forEach((activity) => {
      const stamp = activity.timestamp?.getTime?.() || new Date(activity.timestamp).getTime();
      if (Number.isNaN(stamp) || stamp < sevenDaysAgo) return;
      const day = new Date(stamp).getDay();
      dayBuckets[day] += 1;
    });

    return [
      { day: "Mon", value: dayBuckets[1] },
      { day: "Tue", value: dayBuckets[2] },
      { day: "Wed", value: dayBuckets[3] },
      { day: "Thu", value: dayBuckets[4] },
      { day: "Fri", value: dayBuckets[5] },
      { day: "Sat", value: dayBuckets[6] },
      { day: "Sun", value: dayBuckets[0] },
    ];
  }, [activityTimeline]);

  const weeklyActivityTotal = useMemo(
    () => weeklyVolumeData.reduce((sum, item) => sum + item.value, 0),
    [weeklyVolumeData]
  );

  const weeklyPeakDay = useMemo(() => {
    if (!weeklyVolumeData.length) return { day: "Mon", value: 0 };
    return weeklyVolumeData.reduce((peak, item) => (item.value > peak.value ? item : peak), weeklyVolumeData[0]);
  }, [weeklyVolumeData]);

  const totalAssets = files.length + folders.length;
  const storageUsedRate = totalAssets > 0
    ? Math.min(100, Math.round(((sharedFilesCount + sharedFoldersCount) / totalAssets) * 100))
    : 0;
  const engagementRate = groupStats.totalMembers > 0
    ? Math.min(100, Math.round(((groupStats.totalNotifications + groupStats.totalAnnouncements) / groupStats.totalMembers) * 100))
    : 0;
  const growthIndex = Math.max(
    0,
    Math.round((groupStats.totalMembers * 0.5) + (groupStats.totalNotifications * 1.4) + (groupStats.totalAnnouncements * 1.2))
  );

  const topGroupsByMembers = useMemo(
    () => [...groups].sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0)).slice(0, 3),
    [groups]
  );

  const kpiCards = [
    { label: "Total Groups", value: groupStats.totalGroups, note: "Active departments", tone: "is-blue" },
    { label: "Total Members", value: groupStats.totalMembers, note: `Avg ${groupStats.avgMembersPerGroup}/group`, tone: "is-teal" },
    { label: "Notifications", value: groupStats.totalNotifications, note: "Operational updates", tone: "is-amber" },
    { label: "Announcements", value: groupStats.totalAnnouncements, note: "Broadcast posts", tone: "is-slate" },
  ];

  const tabOptions = [
    { key: "overview", label: "Overview", icon: <FaChartBar /> },
    { key: "manage", label: "Members", icon: <FaUsers /> },
    { key: "shared", label: "Analytics", icon: <FaShareAlt /> },
    { key: "history", label: "Activity", icon: <FaHistory /> },
  ];

  const getActivityBadgeLabel = (type) => {
    if (type === "group_created") return "SYSTEM";
    if (type === "member_added") return "SUCCESSFUL";
    if (type === "notification_added") return "NOTICE";
    if (type === "announcement_added") return "UPDATE";
    if (type === "file_shared" || type === "folder_shared") return "SHARED";
    return "EVENT";
  };

  const getActivityIcon = (type) => {
    if (type === "group_created") return <FaUsers />;
    if (type === "member_added") return <FaUser />;
    if (type === "file_shared") return <FaFileAlt />;
    if (type === "folder_shared") return <FaFolder />;
    if (type === "notification_added") return <FaBell />;
    if (type === "announcement_added") return <FaBullhorn />;
    return <FaInfoCircle />;
  };

  const getLatestGroupPulse = (group) => {
    const updates = [
      ...(group.notifications || []).map((item) => ({
        title: item?.title || "Notification",
        summary: item?.message || "No message content",
        stamp: new Date(item?.createdAt || group.createdAt || Date.now()),
      })),
      ...(group.announcements || []).map((item) => ({
        title: item?.title || "Announcement",
        summary: item?.content || "No announcement content",
        stamp: new Date(item?.createdAt || group.createdAt || Date.now()),
      })),
    ]
      .map((entry) => ({
        ...entry,
        stamp: Number.isNaN(entry.stamp.getTime()) ? new Date() : entry.stamp,
      }))
      .sort((a, b) => b.stamp - a.stamp);

    return updates[0] || null;
  };

  const formatTimestamp = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No timestamp";
    return date.toLocaleString();
  };

  const renderGroupCard = (group, index, { withDelete = false } = {}) => {
    const pulse = getLatestGroupPulse(group);
    const memberList = group.members || [];
    const accentClass = getGroupAccentClass(group.name, index);
    const primaryLeader = group.leaders?.[0]?.email || null;

    return (
      <div key={group._id} className="col-12 col-md-6 col-xxl-4">
        <article className={`gm-group-card ${accentClass}`}>
          <header className="gm-group-card-top">
            <div>
              <h5 className="mb-1">{group.name}</h5>
              <p className="mb-0">{group.description || "No description yet."}</p>
              <small className="gm-card-created">
                Created {new Date(group.createdAt).toLocaleDateString()}
              </small>
            </div>
            <div className="gm-group-tools">
              <button
                className="btn btn-sm gm-icon-btn"
                onClick={() => {
                  setSelectedGroup(group);
                  setShowEditModal(true);
                }}
                title="Edit Group"
              >
                <FaEdit />
              </button>
              {withDelete && (
                <button
                  className="btn btn-sm gm-icon-btn danger"
                  onClick={() => handleDeleteGroup(group._id)}
                  title="Delete Group"
                >
                  <FaTrash />
                </button>
              )}
            </div>
          </header>

          <div className="gm-group-card-body">
            {primaryLeader && (
              <div className="gm-leader-badge">
                <FaCrown className="me-1" />
                Leader: {primaryLeader}
              </div>
            )}
            <div className="gm-member-strip">
              <div className="gm-member-stack">
                {memberList.slice(0, 4).map((member, memberIndex) => (
                  <span
                    key={member?._id || memberIndex}
                    className="gm-member-avatar"
                    style={{ zIndex: 5 - memberIndex }}
                  >
                    {(member?.email?.charAt(0) || member?.name?.charAt(0) || "U").toUpperCase()}
                  </span>
                ))}
                {memberList.length > 4 && (
                  <span className="gm-member-overflow">+{memberList.length - 4}</span>
                )}
                {memberList.length === 0 && <span className="gm-member-empty">No members yet</span>}
              </div>
              <div className="gm-member-count">{memberList.length} Members</div>
            </div>

            <div className="gm-group-pulse">
              <div className="gm-pulse-title">{pulse ? pulse.title : "No recent activity"}</div>
              <p className="mb-0">{pulse ? pulse.summary : "Publish updates to keep this group informed."}</p>
            </div>

            <div className="gm-stat-pill-row">
              <span className="gm-stat-pill">{group.notifications?.length || 0} Notifications</span>
              <span className="gm-stat-pill">{group.announcements?.length || 0} Announcements</span>
              <span className="gm-stat-pill">{(group.sharedFiles?.length || 0) + (group.sharedFolders?.length || 0)} Shared</span>
            </div>

            <div className="gm-card-actions-grid">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => {
                  setSelectedGroup(group);
                  setShowMembersModal(true);
                }}
              >
                <FaUsers className="me-1" /> Manage Members
              </button>
              <button
                className="btn btn-sm btn-outline-info"
                onClick={() => {
                  setSelectedGroup(group);
                  setShowShareModal(true);
                  refreshDashboard({ silent: true, includeAssets: true });
                }}
              >
                <FaShareAlt className="me-1" /> Share Files
              </button>
              <button
                className="btn btn-sm btn-outline-warning"
                onClick={() => {
                  setSelectedGroup(group);
                  setShowNotificationModal(true);
                }}
              >
                <FaBell className="me-1" /> Notify
              </button>
              <button
                className="btn btn-sm btn-outline-success"
                onClick={() => {
                  setSelectedGroup(group);
                  setShowAnnouncementModal(true);
                }}
              >
                <FaBullhorn className="me-1" /> Announce
              </button>
            </div>
          </div>
        </article>
      </div>
    );
  };

  return (
    <div className="container-fluid py-3 admin-analytics-page group-management-dashboard">
      <div className="gm-dashboard-shell">
        <section className="gm-dashboard-header">
          <div className="gm-header-top">
            <div>
              <p className="gm-eyebrow mb-1">
                {activeTab === "history" ? "SYSTEM LOGS" : "INSTITUTIONAL OVERVIEW"}
              </p>
              <h2 className="gm-title mb-2">
                {activeTab === "history" ? "Group Activity Timeline" : "Manage Departments"}
              </h2>
              <p className="gm-subtitle mb-0">
                {activeTab === "history"
                  ? "A chronological record of group activity, collaboration events, and administrative actions."
                  : "A clear command center for departments, membership health, and cross-group collaboration."}
              </p>
            </div>
            <div className="gm-top-kpis">
              <div className="gm-mini-kpi">
                <small>Total Members</small>
                <strong>{groupStats.totalMembers.toLocaleString()}</strong>
              </div>
              <div className="gm-mini-kpi">
                <small>Total Files</small>
                <strong>{Math.max(files.length, sharedFilesCount).toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div className="gm-toolbar">
            <div className="gm-search-box">
              <FaSearch className="gm-search-icon" />
              <input
                type="text"
                className="form-control gm-search-input"
                placeholder="Search and filter groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="gm-toolbar-actions">
              <button
                className="btn btn-outline-primary"
                onClick={() =>
                  refreshDashboard({
                    includeAssets: activeTab === "shared" || showShareModal,
                  })
                }
                disabled={loading || refreshing}
              >
                <FaSync className={loading || refreshing ? "fa-spin me-2" : "me-2"} />
                Refresh
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <FaPlus className="me-2" /> Create Group
              </button>
            </div>
          </div>

          <div className="gm-tab-strip" role="tablist" aria-label="Group management views">
            {tabOptions.map((tab) => (
              <button
                key={tab.key}
                className={`gm-tab-btn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                aria-selected={activeTab === tab.key}
              >
                <span className="me-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="analytics-meta-strip mt-3">
            <span className={`analytics-live-pill ${refreshing ? "is-refreshing" : "is-live"}`}>
              {refreshing ? "Syncing..." : `Live every ${Math.round(REFRESH_INTERVAL_MS / 1000)}s`}
            </span>
            <small className="analytics-last-updated text-muted">
              {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Fetching data..."}
            </small>
            <span className="analytics-chip">Leader coverage: {leaderCoverage}%</span>
            <span className="analytics-chip">Collaboration density: {collaborationDensity}</span>
            <span className="analytics-chip">Shared assets: {sharedFilesCount + sharedFoldersCount}</span>
          </div>
        </section>

        {activeTab === "overview" && (
          <section className="gm-view-stack">
            <div className="row g-4">
              <div className="col-xl-8">
                <article className="gm-glass-card h-100">
                  <div className="gm-card-heading">
                    <h6 className="mb-1">Activity Volume (7 Days)</h6>
                    <small className="text-muted">{weeklyActivityTotal} events logged this week</small>
                  </div>
                  <div className="gm-chart-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={weeklyVolumeData}>
                        <XAxis dataKey="day" axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(10, 102, 255, 0.08)" }}
                          contentStyle={{ borderRadius: "12px", borderColor: "rgba(148, 163, 184, 0.4)" }}
                        />
                        <Legend />
                        <Bar dataKey="value" name="Activity" fill="#0a66ff" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>
              <div className="col-xl-4">
                <article className="gm-growth-card h-100">
                  <div className="gm-growth-icon">
                    <FaChartBar />
                  </div>
                  <h5 className="mb-2">Growth Index</h5>
                  <p>
                    Group momentum is strongest on {weeklyPeakDay.day} with {weeklyPeakDay.value} tracked events.
                  </p>
                  <div className="gm-growth-number">+{growthIndex}</div>
                  <small>Composite activity score</small>
                </article>
              </div>
            </div>

            <div className="gm-kpi-grid">
              {kpiCards.map((kpi) => (
                <article key={kpi.label} className={`gm-kpi-card ${kpi.tone}`}>
                  <small>{kpi.label}</small>
                  <h4>{Number(kpi.value).toLocaleString()}</h4>
                  <p className="mb-0">{kpi.note}</p>
                </article>
              ))}
            </div>

            <div className="gm-section-header">
              <h5 className="mb-1">Department Groups</h5>
              <small className="text-muted">
                Showing {Math.min(filteredGroups.length, 3)} of {filteredGroups.length} filtered groups
              </small>
            </div>

            <div className="row g-4">
              {filteredGroups.slice(0, 3).map((group, index) => renderGroupCard(group, index))}
              <div className="col-12 col-md-6 col-xxl-4">
                <article className="gm-create-card">
                  <div className="gm-create-icon">
                    <FaPlus />
                  </div>
                  <h5>Create New Group</h5>
                  <p>Initialize a new organization unit and bring members, files, and notifications into one workspace.</p>
                  <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    Get Started
                  </button>
                </article>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-xl-8">
                <article className="gm-glass-card h-100">
                  <div className="gm-card-heading d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Recent Group Activity</h6>
                    <button className="btn btn-link p-0 gm-link-btn" onClick={() => setActiveTab("history")}>
                      View Global Log
                    </button>
                  </div>
                  <div className="gm-feed-list">
                    {filteredActivityTimeline.slice(0, 4).map((activity) => (
                      <div key={activity.id} className="gm-feed-item">
                        <span className={`gm-feed-icon type-${activity.type}`}>
                          {getActivityIcon(activity.type)}
                        </span>
                        <div className="gm-feed-content">
                          <strong>{activity.title}</strong>
                          <p className="mb-0">{activity.description}</p>
                          <small className="text-muted">{formatTimestamp(activity.timestamp)}</small>
                        </div>
                      </div>
                    ))}
                    {filteredActivityTimeline.length === 0 && (
                      <div className="gm-empty-state-inline">
                        <FaInfoCircle className="me-2" /> No activity in the selected view.
                      </div>
                    )}
                  </div>
                </article>
              </div>
              <div className="col-xl-4">
                <article className="gm-insights-card h-100">
                  <h5>Group Insights</h5>
                  <div className="gm-progress-row">
                    <div className="d-flex justify-content-between">
                      <small>Storage Used</small>
                      <strong>{storageUsedRate}%</strong>
                    </div>
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${storageUsedRate}%` }} />
                    </div>
                  </div>
                  <div className="gm-progress-row">
                    <div className="d-flex justify-content-between">
                      <small>Engagement</small>
                      <strong>{engagementRate}%</strong>
                    </div>
                    <div className="progress">
                      <div className="progress-bar secondary" style={{ width: `${engagementRate}%` }} />
                    </div>
                  </div>
                  <div className="gm-insight-chart">
                    {activityData.some((item) => item.value > 0) ? (
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={activityData} dataKey="value" innerRadius={38} outerRadius={58}>
                            {activityData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="gm-empty-state-inline">No activity distribution yet.</div>
                    )}
                  </div>
                  <div className="gm-top-groups">
                    <small className="gm-top-groups-label">Top Member Groups</small>
                    {topGroupsByMembers.length > 0 ? (
                      topGroupsByMembers.map((group) => (
                        <div key={group._id} className="gm-top-group-row">
                          <span>{group.name}</span>
                          <strong>{group.members?.length || 0}</strong>
                        </div>
                      ))
                    ) : (
                      <small className="text-muted">No member data yet.</small>
                    )}
                  </div>
                  <p className="gm-tip mb-0">
                    Groups with frequent updates and shared assets typically see stronger participation and retention.
                  </p>
                </article>
              </div>
            </div>
          </section>
        )}

        {activeTab === "manage" && (
          <section className="gm-view-stack">
            <div className="gm-section-header">
              <h5 className="mb-1">Group Directory</h5>
              <small className="text-muted">
                {filteredGroups.length} of {groups.length} groups match your search
              </small>
            </div>

            {filteredGroups.length > 0 ? (
              <div className="row g-4">
                {filteredGroups.map((group, index) => renderGroupCard(group, index, { withDelete: true }))}
              </div>
            ) : (
              <article className="gm-empty-state-panel">
                <FaUsers size={54} />
                <h5 className="mt-3">No groups found</h5>
                <p>{searchTerm ? "Try a different keyword." : "Create your first group to get started."}</p>
                {!searchTerm && (
                  <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <FaPlus className="me-2" /> Create Group
                  </button>
                )}
              </article>
            )}
          </section>
        )}

        {activeTab === "shared" && (
          <section className="gm-view-stack">
            {filteredGroups.length > 0 ? (
              <div className="row g-4">
                {filteredGroups.map((group) => (
                  <div key={group._id} className="col-12">
                    <article className="gm-glass-card">
                      <div className="gm-shared-header">
                        <div>
                          <h6 className="mb-1">{group.name}</h6>
                          <small className="text-muted">
                            {group.sharedFiles?.length || 0} files and {group.sharedFolders?.length || 0} folders shared
                          </small>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            setSelectedGroup(group);
                            setShowShareModal(true);
                            refreshDashboard({ silent: true, includeAssets: true });
                          }}
                        >
                          <FaPlus className="me-1" /> Add Share
                        </button>
                      </div>

                      <div className="row g-3 mt-1">
                        {(group.sharedFiles || []).map((sharedFile, index) => (
                          <div key={`file-${index}`} className="col-md-6 col-xl-4">
                            <div className="gm-shared-item">
                              <div>
                                <strong>{sharedFile?.fileId?.originalName || "Unknown File"}</strong>
                                <p className="mb-0 text-muted small">
                                  {sharedFile?.permission === "editor" || sharedFile?.permission === "write" ? "Editor" : "Viewer"} permission
                                </p>
                                <small className="text-muted d-block">Shared by {sharedFile?.sharedBy?.email || "Unknown"}</small>
                                <small className="text-muted">{formatTimestamp(sharedFile?.sharedAt)}</small>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleUnshareFromGroup(group._id, "file", sharedFile._id)}
                                title="Remove file share"
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                        ))}

                        {(group.sharedFolders || []).map((sharedFolder, index) => (
                          <div key={`folder-${index}`} className="col-md-6 col-xl-4">
                            <div className="gm-shared-item">
                              <div>
                                <strong>{sharedFolder?.folderId?.name || "Unknown Folder"}</strong>
                                <p className="mb-0 text-muted small">
                                  {sharedFolder?.permission === "editor" || sharedFolder?.permission === "write" ? "Editor" : "Viewer"} permission
                                </p>
                                <small className="text-muted d-block">Shared by {sharedFolder?.sharedBy?.email || "Unknown"}</small>
                                <small className="text-muted">{formatTimestamp(sharedFolder?.sharedAt)}</small>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleUnshareFromGroup(group._id, "folder", sharedFolder._id)}
                                title="Remove folder share"
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {(!group.sharedFiles || group.sharedFiles.length === 0) &&
                        (!group.sharedFolders || group.sharedFolders.length === 0) && (
                          <div className="gm-empty-state-inline mt-3">
                            <FaShareAlt className="me-2" />
                            No files or folders are currently shared with this group.
                          </div>
                        )}
                    </article>
                  </div>
                ))}
              </div>
            ) : (
              <article className="gm-empty-state-panel">
                <FaShareAlt size={54} />
                <h5 className="mt-3">No shared items</h5>
                <p>Create and populate groups first to manage shared content.</p>
              </article>
            )}
          </section>
        )}

        {activeTab === "history" && (
          <section className="gm-view-stack">
            <article className="gm-glass-card">
              <div className="gm-card-heading">
                <h6 className="mb-1">Group Activity Timeline</h6>
                <small className="text-muted">Latest 50 chronological group events</small>
              </div>
              <div className="gm-timeline">
                {filteredActivityTimeline.length > 0 ? (
                  filteredActivityTimeline.slice(0, 50).map((activity) => (
                    <div key={activity.id} className="gm-timeline-item">
                      <div className={`gm-timeline-marker type-${activity.type}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="gm-timeline-content">
                        <div className="gm-timeline-head">
                          <div>
                            <h6 className="mb-1">{activity.title}</h6>
                            <p className="mb-1">{activity.description}</p>
                            {activity.details && <small className="text-muted">{activity.details}</small>}
                            <small className="d-block text-muted">Group: {activity.group}</small>
                          </div>
                          <div className="text-end">
                            <small className="d-block text-muted">{formatTimestamp(activity.timestamp)}</small>
                            <span className="gm-status-pill">{getActivityBadgeLabel(activity.type)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="gm-empty-state-inline">
                    <FaHistory className="me-2" />
                    No timeline activity for the current filter.
                  </div>
                )}
              </div>
            </article>
          </section>
        )}
      </div>
      {/* Modals */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateGroup}
        />
      )}

      {showEditModal && selectedGroup && (
        <EditGroupModal
          group={selectedGroup}
          onClose={() => {
            setShowEditModal(false);
            setSelectedGroup(null);
          }}
          onSubmit={handleUpdateGroup}
        />
      )}

      {showMembersModal && selectedGroup && (
        <ManageMembersModal
          group={selectedGroup}
          users={users}
          onClose={() => {
            setShowMembersModal(false);
            setSelectedGroup(null);
          }}
          onAddMembers={handleAddMembers}
          onRemoveMember={handleRemoveMember}
          onToggleLeader={handleToggleLeader}
        />
      )}

      {showShareModal && selectedGroup && (
        <ShareToGroupModal
          group={selectedGroup}
          files={files}
          folders={folders}
          onClose={() => {
            setShowShareModal(false);
            setSelectedGroup(null);
          }}
          onSubmit={handleShareToGroup}
        />
      )}

      {showNotificationModal && selectedGroup && (
        <NotificationModal
          group={selectedGroup}
          onClose={() => {
            setShowNotificationModal(false);
            setSelectedGroup(null);
          }}
          onSubmit={handleAddNotification}
        />
      )}

      {showAnnouncementModal && selectedGroup && (
        <AnnouncementModal
          group={selectedGroup}
          onClose={() => {
            setShowAnnouncementModal(false);
            setSelectedGroup(null);
          }}
          onSubmit={handleAddAnnouncement}
        />
      )}
    </div>
  );
}

// Create Group Modal Component
function CreateGroupModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Group name is required");
      return;
    }
    onSubmit(name, description);
    setName("");
    setDescription("");
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Create Group</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Group Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Edit Group Modal Component
function EditGroupModal({ group, onClose, onSubmit }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Group name is required");
      return;
    }
    onSubmit(group._id, name, description);
    setName("");
    setDescription("");
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Group</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Group Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Update
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Manage Members Modal Component
function ManageMembersModal({ group, users, onClose, onAddMembers, onRemoveMember, onToggleLeader }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const availableUsers = users.filter(
    (user) =>
      !group.members?.some((m) => m._id?.toString() === user._id.toString()) &&
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
      user.role !== "superadmin"
  );

  const handleAdd = () => {
    if (selectedUsers.length === 0) {
      alert("Please select at least one user");
      return;
    }
    const userIds = selectedUsers.map((u) => u._id);
    onAddMembers(group._id, userIds);
    setSelectedUsers([]);
  };

  const toggleUser = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user]
    );
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Manage Members - {group.name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <h6>Current Members ({group.members?.length || 0})</h6>
              <div className="list-group" style={{ maxHeight: "200px", overflowY: "auto" }}>
                {group.members?.length > 0 ? (
                  group.members.map((member) => {
                    const isLeader = group.leaders?.some(l => l._id === member._id);
                    return (
                      <div
                        key={member._id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span>{member.email || member._id}</span>
                          {isLeader && <span className="badge bg-warning text-dark"><FaCrown size={12} className="me-1"/> Leader</span>}
                        </div>
                        <div className="btn-group">
                          <button
                            className={`btn btn-sm ${isLeader ? "btn-warning" : "btn-outline-secondary"}`}
                            onClick={() => onToggleLeader(group._id, member._id, isLeader ? "remove" : "add")}
                            title={isLeader ? "Demote from Leader" : "Promote to Leader"}
                          >
                            <FaCrown />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onRemoveMember(group._id, member._id)}
                            title="Remove Member"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted">No members yet</p>
                )}
              </div>
            </div>

            <div>
              <h6>Add Members</h6>
              <div className="list-group" style={{ maxHeight: "200px", overflowY: "auto" }}>
                {availableUsers.length > 0 ? (
                  availableUsers.map((user) => (
                    <div
                      key={user._id}
                      className="list-group-item d-flex justify-content-between align-items-center"
                    >
                      <span>{user.email}</span>
                      <button
                        className={`btn btn-sm ${
                          selectedUsers.some((u) => u._id === user._id)
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => toggleUser(user)}
                      >
                        {selectedUsers.some((u) => u._id === user._id) ? (
                          <FaCheck />
                        ) : (
                          <FaPlus />
                        )}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">No available users</p>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={selectedUsers.length === 0}
            >
              Add Selected ({selectedUsers.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Share to Group Modal Component
function ShareToGroupModal({ group, files, folders, onClose, onSubmit }) {
  const [type, setType] = useState("file");
  const [selectedItem, setSelectedItem] = useState("");
  const [permission, setPermission] = useState("viewer");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedItem) {
      alert("Please select a file or folder");
      return;
    }
    onSubmit(group._id, type, selectedItem, permission);
  };

  const items = useMemo(() => {
    const allItems = type === "file" ? files : folders;
    if (!group) return allItems;

    if (type === "file") {
      const sharedIds = new Set((group.sharedFiles || []).map(sf => sf.fileId));
      return allItems.filter(item => !sharedIds.has(item._id));
    } else {
      const sharedIds = new Set((group.sharedFolders || []).map(sf => sf.folderId));
      return allItems.filter(item => !sharedIds.has(item._id));
    }
  }, [type, files, folders, group]);

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Share to {group.name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setSelectedItem("");
                  }}
                >
                  <option value="file">File</option>
                  <option value="folder">Folder</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Select {type}</label>
                <select
                  className="form-select"
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  required
                >
                  <option value="">Choose a {type}...</option>
                  {items.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.originalName || item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Permission</label>
                <select
                  className="form-select"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                >
                  <option value="editor">Editor (edit, view, download, comment)</option>
                  <option value="viewer">Viewer (view, download, comment)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Share
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Notification Modal Component
function NotificationModal({ group, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert("Title and message are required");
      return;
    }
    onSubmit(group._id, title, message);
    setTitle("");
    setMessage("");
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add Notification - {group.name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Message *</label>
                <textarea
                  className="form-control"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows="4"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Notification
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Announcement Modal Component
function AnnouncementModal({ group, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert("Title and content are required");
      return;
    }
    onSubmit(group._id, title, content);
    setTitle("");
    setContent("");
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add Announcement - {group.name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Content *</label>
                <textarea
                  className="form-control"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows="5"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Announcement
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

