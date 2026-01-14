import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  FaUsers, FaPlus, FaEdit, FaTrash, FaShareAlt, FaBell, FaBullhorn,
  FaTimes, FaCheck, FaSearch, FaFilter, FaChartBar, FaCrown,
  FaShieldAlt, FaUser, FaCalendarAlt, FaSync, FaInfoCircle, FaHistory,
  FaFileAlt, FaFolder
} from "react-icons/fa";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from "recharts";
import "bootstrap/dist/css/bootstrap.min.css";
import { BACKEND_URL } from "../../config";

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
  const [loading, _setLoading] = useState(false);

  const userId = localStorage.getItem("userId");

  useEffect(() => {
    fetchGroups();
    fetchUsers();
    fetchFilesAndFolders();
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

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/groups`);
      setGroups(res.data || []);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/users`);
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchFilesAndFolders = async () => {
    try {
      const [filesRes, foldersRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/files`, { params: { role: "admin" } }),
        axios.get(`${BACKEND_URL}/folders`, { params: { role: "admin" } }),
      ]);
      setFiles(filesRes.data || []);
      setFolders(foldersRes.data || []);
    } catch (err) {
      console.error("Failed to fetch files/folders:", err);
    }
  };

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
      await axios.patch(`${BACKEND_URL}/groups/${groupId}/members`, { userIds });
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
      await axios.delete(`${BACKEND_URL}/groups/${groupId}/members/${userId}`);
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
        action
      });
      fetchGroups();
      
      // Update selected group to reflect changes immediately in modal
      setSelectedGroup(prev => {
        if (!prev) return null;
        const newLeaders = action === "add" 
          ? [...(prev.leaders || []), { _id: userId }] // minimal update
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

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            <FaUsers className="me-2 text-primary" />
            Group Management Dashboard
          </h4>
          <small className="text-muted">Comprehensive group administration and analytics</small>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <FaPlus className="me-2" /> Create Group
        </button>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <FaChartBar className="me-1" /> Overview
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "manage" ? "active" : ""}`}
            onClick={() => setActiveTab("manage")}
          >
            <FaUsers className="me-1" /> Manage Groups
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "shared" ? "active" : ""}`}
            onClick={() => setActiveTab("shared")}
          >
            <FaShareAlt className="me-1" /> Shared Items
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <FaHistory className="me-1" /> Activity History
          </button>
        </li>
      </ul>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Key Metrics Cards */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card shadow-sm border-primary">
                <div className="card-body text-center">
                  <FaUsers className="text-primary mb-2" size={32} />
                  <h5 className="card-title mb-1">{groupStats.totalGroups}</h5>
                  <small className="text-muted">Total Groups</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm border-success">
                <div className="card-body text-center">
                  <FaUser className="text-success mb-2" size={32} />
                  <h5 className="card-title mb-1">{groupStats.totalMembers}</h5>
                  <small className="text-muted">Total Members</small>
                  <div className="mt-2 small">
                    Avg: {groupStats.avgMembersPerGroup} per group
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm border-warning">
                <div className="card-body text-center">
                  <FaBell className="text-warning mb-2" size={32} />
                  <h5 className="card-title mb-1">{groupStats.totalNotifications}</h5>
                  <small className="text-muted">Notifications</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm border-info">
                <div className="card-body text-center">
                  <FaBullhorn className="text-info mb-2" size={32} />
                  <h5 className="card-title mb-1">{groupStats.totalAnnouncements}</h5>
                  <small className="text-muted">Announcements</small>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaChartBar className="me-2" />
                    Group Activity Distribution
                  </h6>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={activityData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {activityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaCalendarAlt className="me-2" />
                    Recent Group Activity
                  </h6>
                </div>
                <div className="card-body">
                  <div className="list-group list-group-flush">
                    {groups.slice(0, 5).map((group) => (
                      <div key={group._id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <div className="avatar-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center" style={{width: '35px', height: '35px', borderRadius: '50%', fontSize: '14px', fontWeight: 'bold'}}>
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{group.name}</strong>
                            <br />
                            <small className="text-muted">
                              {group.members?.length || 0} members •
                              {group.notifications?.length || 0} notifications •
                              {group.announcements?.length || 0} announcements
                            </small>
                          </div>
                        </div>
                        <small className="text-muted">
                          {new Date(group.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                    ))}
                    {groups.length === 0 && (
                      <div className="text-center py-3 text-muted">
                        <FaInfoCircle className="me-2" />
                        No groups available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Manage Groups Tab */}
      {activeTab === "manage" && (
        <>
          {/* Search Bar */}
          <div className="card shadow-sm mb-4">
            <div className="card-header">
              <h6 className="mb-0">
                <FaSearch className="me-2" />
                Search & Filter Groups
              </h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-8">
                  <div className="input-group">
                    <span className="input-group-text"><FaSearch /></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search groups by name or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <button
                    className="btn btn-outline-primary w-100"
                    onClick={fetchGroups}
                    disabled={loading}
                  >
                    <FaSync className={loading ? "fa-spin me-2" : "me-2"} />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <small className="text-muted">
                  Showing {filteredGroups.length} of {groups.length} groups
                </small>
              </div>
            </div>
          </div>

          {/* Groups Grid */}
          <div className="row g-4">
            {filteredGroups.map((group) => (
              <div key={group._id} className="col-md-6 col-lg-4 mb-4">
                <div className="card h-100 shadow-sm hover-card">
                  <div className="card-header d-flex justify-content-between align-items-center bg-light">
                    <div className="d-flex align-items-center">
                      <div className="avatar-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px', borderRadius: '50%', fontSize: '16px', fontWeight: 'bold'}}>
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold">{group.name}</h6>
                        <small className="text-muted">
                          Created {new Date(group.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                    <div className="btn-group">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowEditModal(true);
                        }}
                        title="Edit Group"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteGroup(group._id)}
                        title="Delete Group"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <p className="text-muted small mb-3">{group.description || "No description provided"}</p>

                    <div className="row text-center mb-3">
                      <div className="col-4">
                        <div className="p-2 bg-light rounded">
                          <h6 className="mb-0 text-primary">{group.members?.length || 0}</h6>
                          <small className="text-muted">Members</small>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-2 bg-light rounded">
                          <h6 className="mb-0 text-warning">{group.notifications?.length || 0}</h6>
                          <small className="text-muted">Notifications</small>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-2 bg-light rounded">
                          <h6 className="mb-0 text-info">{group.announcements?.length || 0}</h6>
                          <small className="text-muted">Announcements</small>
                        </div>
                      </div>
                    </div>

                    <div className="d-grid gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowMembersModal(true);
                        }}
                      >
                        <FaUsers className="me-2" /> Manage Members
                      </button>
                      <button
                        className="btn btn-sm btn-outline-info"
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowShareModal(true);
                        }}
                      >
                        <FaShareAlt className="me-2" /> Share Files/Folders
                      </button>
                      <div className="row g-1">
                        <div className="col-6">
                          <button
                            className="btn btn-sm btn-outline-warning w-100"
                            onClick={() => {
                              setSelectedGroup(group);
                              setShowNotificationModal(true);
                            }}
                          >
                            <FaBell className="me-1" /> Notify
                          </button>
                        </div>
                        <div className="col-6">
                          <button
                            className="btn btn-sm btn-outline-success w-100"
                            onClick={() => {
                              setSelectedGroup(group);
                              setShowAnnouncementModal(true);
                            }}
                          >
                            <FaBullhorn className="me-1" /> Announce
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredGroups.length === 0 && (
            <div className="text-center py-5">
              <FaUsers className="text-muted mb-3" size={64} />
              <h5 className="text-muted">No groups found</h5>
              <p className="text-muted mb-3">
                {searchTerm ? "Try adjusting your search terms" : "Create your first group to get started"}
              </p>
              {!searchTerm && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  <FaPlus className="me-2" /> Create Group
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Shared Items Tab */}
      {activeTab === "shared" && (
        <>
          <div className="row">
            {groups.map((group) => (
              <div key={group._id} className="col-12 mb-4">
                <div className="card shadow-sm">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <div className="avatar-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px', borderRadius: '50%', fontSize: '16px', fontWeight: 'bold'}}>
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold">{group.name}</h6>
                        <small className="text-muted">
                          {group.sharedFiles?.length || 0} files, {group.sharedFolders?.length || 0} folders shared
                        </small>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    {/* Shared Files */}
                    {group.sharedFiles && group.sharedFiles.length > 0 && (
                      <div className="mb-4">
                        <h6 className="text-primary mb-3">
                          <FaFileAlt className="me-2" />
                          Shared Files ({group.sharedFiles.length})
                        </h6>
                        <div className="row g-3">
                          {group.sharedFiles.map((sharedFile, index) => (
                            <div key={index} className="col-md-6 col-lg-4">
                              <div className="card border-light shadow-sm">
                                <div className="card-body">
                                  <div className="d-flex align-items-start justify-content-between">
                                    <div className="flex-grow-1">
                                      <h6 className="card-title mb-1 text-truncate">
                                        {sharedFile.fileId?.originalName || 'Unknown File'}
                                      </h6>
                                      <p className="card-text small text-muted mb-2">
                                        Permission: <span className={`badge ${sharedFile.permission === 'write' ? 'bg-success' : 'bg-info'}`}>
                                          {sharedFile.permission === 'write' ? 'Read & Write' : 'Read Only'}
                                        </span>
                                      </p>
                                      <small className="text-muted">
                                        Shared by: {sharedFile.sharedBy?.email || 'Unknown'}<br/>
                                        {new Date(sharedFile.sharedAt).toLocaleDateString()}
                                      </small>
                                    </div>
                                    <button
                                      className="btn btn-sm btn-outline-danger ms-2"
                                      onClick={() => handleUnshareFromGroup(group._id, 'file', sharedFile.fileId?._id)}
                                      title="Remove from group"
                                    >
                                      <FaTimes />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shared Folders */}
                    {group.sharedFolders && group.sharedFolders.length > 0 && (
                      <div>
                        <h6 className="text-success mb-3">
                          <FaFolder className="me-2" />
                          Shared Folders ({group.sharedFolders.length})
                        </h6>
                        <div className="row g-3">
                          {group.sharedFolders.map((sharedFolder, index) => (
                            <div key={index} className="col-md-6 col-lg-4">
                              <div className="card border-light shadow-sm">
                                <div className="card-body">
                                  <div className="d-flex align-items-start justify-content-between">
                                    <div className="flex-grow-1">
                                      <h6 className="card-title mb-1 text-truncate">
                                        {sharedFolder.folderId?.name || 'Unknown Folder'}
                                      </h6>
                                      <p className="card-text small text-muted mb-2">
                                        Permission: <span className={`badge ${sharedFolder.permission === 'write' ? 'bg-success' : 'bg-info'}`}>
                                          {sharedFolder.permission === 'write' ? 'Read & Write' : 'Read Only'}
                                        </span>
                                      </p>
                                      <small className="text-muted">
                                        Shared by: {sharedFolder.sharedBy?.email || 'Unknown'}<br/>
                                        {new Date(sharedFolder.sharedAt).toLocaleDateString()}
                                      </small>
                                    </div>
                                    <button
                                      className="btn btn-sm btn-outline-danger ms-2"
                                      onClick={() => handleUnshareFromGroup(group._id, 'folder', sharedFolder.folderId?._id)}
                                      title="Remove from group"
                                    >
                                      <FaTimes />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No shared items */}
                    {(!group.sharedFiles || group.sharedFiles.length === 0) &&
                     (!group.sharedFolders || group.sharedFolders.length === 0) && (
                      <div className="text-center py-4">
                        <FaShareAlt className="text-muted mb-3" size={48} />
                        <p className="text-muted mb-0">No files or folders are currently shared with this group.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State for Shared Items */}
          {groups.length === 0 && (
            <div className="text-center py-5">
              <FaShareAlt className="text-muted mb-3" size={64} />
              <h5 className="text-muted">No Groups Available</h5>
              <p className="text-muted">Create groups first to manage shared items.</p>
            </div>
          )}
        </>
      )}

      {/* Activity History Tab */}
      {activeTab === "history" && (
        <>
          <div className="card shadow-sm">
            <div className="card-header">
              <h6 className="mb-0">
                <FaHistory className="me-2" />
                Group Activity Timeline
              </h6>
            </div>
            <div className="card-body">
              <div className="timeline">
                {groups.length > 0 ? (
                  groups.flatMap(group => [
                    // Group creation activity
                    {
                      id: `create-${group._id}`,
                      type: 'group_created',
                      title: 'Group Created',
                      description: `"${group.name}" was created`,
                      timestamp: group.createdAt,
                      group: group.name,
                      icon: <FaUsers className="text-success" />
                    },
                    // Member activities
                    ...(group.members?.map(member => ({
                      id: `member-${group._id}-${member._id}`,
                      type: 'member_added',
                      title: 'Member Added',
                      description: `${member.email || member._id} joined "${group.name}"`,
                      timestamp: group.createdAt, // Using group creation as approximation
                      group: group.name,
                      icon: <FaUser className="text-primary" />
                    })) || []),
                    // Shared file activities
                    ...(group.sharedFiles?.map((sharedFile, index) => ({
                      id: `file-${group._id}-${sharedFile.fileId?._id || index}`,
                      type: 'file_shared',
                      title: 'File Shared',
                      description: `"${sharedFile.fileId?.originalName || 'Unknown File'}" shared with "${group.name}"`,
                      timestamp: sharedFile.sharedAt,
                      group: group.name,
                      icon: <FaFileAlt className="text-info" />,
                      details: `Permission: ${sharedFile.permission === 'write' ? 'Read & Write' : 'Read Only'}`
                    })) || []),
                    // Shared folder activities
                    ...(group.sharedFolders?.map((sharedFolder, index) => ({
                      id: `folder-${group._id}-${sharedFolder.folderId?._id || index}`,
                      type: 'folder_shared',
                      title: 'Folder Shared',
                      description: `"${sharedFolder.folderId?.name || 'Unknown Folder'}" shared with "${group.name}"`,
                      timestamp: sharedFolder.sharedAt,
                      group: group.name,
                      icon: <FaFolder className="text-warning" />,
                      details: `Permission: ${sharedFolder.permission === 'write' ? 'Read & Write' : 'Read Only'}`
                    })) || []),
                    // Notification activities
                    ...(group.notifications?.map((notification, index) => ({
                      id: `notification-${group._id}-${index}`,
                      type: 'notification_added',
                      title: 'Notification Added',
                      description: `"${notification.title}" sent to "${group.name}"`,
                      timestamp: notification.createdAt,
                      group: group.name,
                      icon: <FaBell className="text-warning" />,
                      details: notification.message
                    })) || []),
                    // Announcement activities
                    ...(group.announcements?.map((announcement, index) => ({
                      id: `announcement-${group._id}-${index}`,
                      type: 'announcement_added',
                      title: 'Announcement Added',
                      description: `"${announcement.title}" posted to "${group.name}"`,
                      timestamp: announcement.createdAt,
                      group: group.name,
                      icon: <FaBullhorn className="text-danger" />,
                      details: announcement.content
                    })) || [])
                  ])
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .slice(0, 50) // Limit to 50 most recent activities
                  .map(activity => (
                    <div key={activity.id} className="timeline-item">
                      <div className="timeline-marker">
                        {activity.icon}
                      </div>
                      <div className="timeline-content">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6 className="mb-1">{activity.title}</h6>
                            <p className="mb-1 text-muted">{activity.description}</p>
                            {activity.details && (
                              <p className="mb-1 small text-muted">{activity.details}</p>
                            )}
                            <small className="text-muted">
                              Group: {activity.group}
                            </small>
                          </div>
                          <small className="text-muted timeline-date">
                            {new Date(activity.timestamp).toLocaleString()}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <FaHistory className="text-muted mb-3" size={48} />
                    <h6 className="text-muted">No Activity Yet</h6>
                    <p className="text-muted mb-0">Group activities will appear here as they occur.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

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
      user.role !== "admin" &&
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
  const [permission, setPermission] = useState("read");

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
                  <option value="read">Read</option>
                  <option value="write">Write</option>
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
