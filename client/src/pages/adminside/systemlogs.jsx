// src/pages/SystemLogs.jsx
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  FaSyncAlt, FaUsers, FaFile, FaFolder, FaDatabase, FaChartBar,
  FaSearch, FaDownload, FaFilter, FaEye, FaEyeSlash, FaCalendarAlt,
  FaHdd, FaShare, FaUserCheck, FaUserTimes, FaClock, FaCogs,
  FaExclamationTriangle, FaCheckCircle, FaInfoCircle
} from "react-icons/fa";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
  AreaChart, Area,
  ComposedChart,
  ScatterChart, Scatter
} from "recharts";

import { BACKEND_URL } from "../../config";

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [stats, setStats] = useState({
    // Basic stats
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalFiles: 0,
    totalFolders: 0,
    totalGroups: 0,
    groupsWithMembers: 0,
    totalStorage: 0,
    avgFileSize: 0,

    // Time-based data
    uploadsPerDay: [],
    userRegistrations: [],
    actionsCount: [],

    // Distribution data
    fileTypes: [],

    // Top users
    mostActiveUsers: [],
    topStorageUsers: [],

    // Recent activity
    recentActivity: []
  });

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/logs`);
      setLogs(res.data || []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();

    // Set up realtime updates every 30 seconds
    const interval = setInterval(() => {
      fetchLogs();
      fetchStats();
    }, 30000); // 30 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter logs based on search and filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = !searchTerm ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction = !actionFilter || log.action === actionFilter;
      const matchesUser = !userFilter ||
        (log.user?.email || "System").toLowerCase().includes(userFilter.toLowerCase());

      return matchesSearch && matchesAction && matchesUser;
    });
  }, [logs, searchTerm, actionFilter, userFilter]);

  // Get unique actions for filter
  const uniqueActions = useMemo(() => {
    const actions = [...new Set(logs.map(log => log.action))];
    return actions.filter(action => action);
  }, [logs]);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = [...new Set(logs.map(log => log.user?.email || "System"))];
    return users.filter(user => user);
  }, [logs]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];
  const STATUS_COLORS = {
    success: "#28a745",
    error: "#dc3545",
    warning: "#ffc107",
    info: "#17a2b8"
  };

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            <FaChartBar className="me-2 text-primary" />
            System Analytics Dashboard
          </h4>
          <small className="text-muted">Comprehensive system monitoring and activity insights</small>
        </div>
        <button
          className="btn btn-outline-primary"
          onClick={() => { fetchLogs(); fetchStats(); }}
          disabled={loading}
        >
          <FaSyncAlt className={loading ? "fa-spin me-2" : "me-2"} />
          Refresh Data
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
            className={`nav-link ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <FaUsers className="me-1" /> Users
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "storage" ? "active" : ""}`}
            onClick={() => setActiveTab("storage")}
          >
            <FaHdd className="me-1" /> Storage
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "activity" ? "active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
            <FaClock className="me-1" /> Activity Logs
          </button>
        </li>
      </ul>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Key Metrics Cards */}
          <div className="row g-3 mb-4">
            <div className="col-md-2">
              <div className="card shadow-sm border-primary">
                <div className="card-body text-center">
                  <FaUsers className="text-primary mb-2" size={24} />
                  <h5 className="card-title mb-1">{stats.totalUsers}</h5>
                  <small className="text-muted">Total Users</small>
                  <div className="mt-2">
                    <span className="badge bg-success">{stats.activeUsers} Active</span>
                    <span className="badge bg-secondary ms-1">{stats.inactiveUsers} Inactive</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card shadow-sm border-success">
                <div className="card-body text-center">
                  <FaFile className="text-success mb-2" size={24} />
                  <h5 className="card-title mb-1">{stats.totalFiles}</h5>
                  <small className="text-muted">Total Files</small>
                  <div className="mt-2 small">
                    Avg: {formatFileSize(stats.avgFileSize)}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card shadow-sm border-info">
                <div className="card-body text-center">
                  <FaFolder className="text-info mb-2" size={24} />
                  <h5 className="card-title mb-1">{stats.totalFolders}</h5>
                  <small className="text-muted">Total Folders</small>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card shadow-sm border-warning">
                <div className="card-body text-center">
                  <FaShare className="text-warning mb-2" size={24} />
                  <h5 className="card-title mb-1">{stats.totalGroups}</h5>
                  <small className="text-muted">Total Groups</small>
                  <div className="mt-2 small">
                    {stats.groupsWithMembers} with members
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card shadow-sm border-danger">
                <div className="card-body text-center">
                  <FaHdd className="text-danger mb-2" size={24} />
                  <h5 className="card-title mb-1">{formatFileSize(stats.totalStorage)}</h5>
                  <small className="text-muted">Total Storage</small>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card shadow-sm border-secondary">
                <div className="card-body text-center">
                  <FaCogs className="text-secondary mb-2" size={24} />
                  <h5 className="card-title mb-1">{logs.length}</h5>
                  <small className="text-muted">Total Logs</small>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="row g-4 mb-4">
            <div className="col-lg-8">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaCalendarAlt className="me-2" />
                    Upload Activity (Last 30 Days)
                  </h6>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={stats.uploadsPerDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="uploads" fill="#8884d8" name="Files Uploaded" />
                      <Line yAxisId="right" type="monotone" dataKey="size" stroke="#ff7300" name="Storage Used (bytes)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaChartBar className="me-2" />
                    Action Distribution
                  </h6>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.actionsCount}
                        dataKey="count"
                        nameKey="action"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {stats.actionsCount.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaUsers className="me-2" />
                    User Registrations (Last 30 Days)
                  </h6>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={stats.userRegistrations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="registrations" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaFile className="me-2" />
                    File Type Distribution
                  </h6>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.fileTypes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [name === 'size' ? formatFileSize(value) : value, name === 'size' ? 'Storage' : 'Files']} />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="Files" />
                      <Bar dataKey="size" fill="#82ca9d" name="Storage" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card shadow-sm">
              <div className="card-header">
                <h6 className="mb-0">
                  <FaUserCheck className="me-2" />
                  Most Active Users (Last 30 Days)
                </h6>
              </div>
              <div className="card-body">
                <div className="list-group list-group-flush">
                  {stats.mostActiveUsers.slice(0, 10).map((user) => (
                    <div key={user.email} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{user.email}</strong>
                        <br />
                        <small className="text-muted">Last activity: {new Date(user.lastActivity).toLocaleDateString()}</small>
                      </div>
                      <div className="text-end">
                        <span className="badge bg-primary">{user.actions} actions</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card shadow-sm">
              <div className="card-header">
                <h6 className="mb-0">
                  <FaUserTimes className="me-2" />
                  Top Storage Users
                </h6>
              </div>
              <div className="card-body">
                <div className="list-group list-group-flush">
                  {stats.topStorageUsers.slice(0, 10).map((user, index) => (
                    <div key={user.email} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{user.email}</strong>
                        <br />
                        <small className="text-muted">{user.totalFiles} files</small>
                      </div>
                      <div className="text-end">
                        <span className="badge bg-success">{formatFileSize(user.totalSize)}</span>
                        <div className="mt-1">
                          <small className="text-muted">#{index + 1}</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Tab */}
      {activeTab === "storage" && (
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card shadow-sm">
              <div className="card-header">
                <h6 className="mb-0">
                  <FaHdd className="me-2" />
                  Storage Analytics
                </h6>
              </div>
              <div className="card-body">
                <div className="row text-center mb-4">
                  <div className="col-md-3">
                    <div className="p-3 bg-light rounded">
                      <h4 className="text-primary">{formatFileSize(stats.totalStorage)}</h4>
                      <small className="text-muted">Total Storage Used</small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 bg-light rounded">
                      <h4 className="text-success">{stats.totalFiles}</h4>
                      <small className="text-muted">Total Files</small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 bg-light rounded">
                      <h4 className="text-info">{formatFileSize(stats.avgFileSize)}</h4>
                      <small className="text-muted">Average File Size</small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 bg-light rounded">
                      <h4 className="text-warning">{stats.totalFolders}</h4>
                      <small className="text-muted">Total Folders</small>
                    </div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.fileTypes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value, name) => [name === 'size' ? formatFileSize(value) : value, name === 'size' ? 'Storage Size' : 'File Count']} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="File Count" />
                    <Bar yAxisId="right" dataKey="size" fill="#82ca9d" name="Storage Size" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-header">
                <h6 className="mb-0">
                  <FaFile className="me-2" />
                  File Type Breakdown
                </h6>
              </div>
              <div className="card-body">
                <div className="list-group list-group-flush">
                  {stats.fileTypes.map((type, _index) => (
                    <div key={type.type} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{type.type.toUpperCase()}</strong>
                        <br />
                        <small className="text-muted">{type.count} files</small>
                      </div>
                      <span className="badge bg-primary">{formatFileSize(type.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === "activity" && (
        <>
          {/* Recent Activity */}
          <div className="card shadow-sm mb-4">
            <div className="card-header">
              <h6 className="mb-0">
                <FaClock className="me-2" />
                Recent Activity (Last 24 Hours)
              </h6>
            </div>
            <div className="card-body">
              <div className="row">
                {stats.recentActivity.slice(0, 12).map((activity, index) => (
                  <div key={activity.id} className="col-md-6 col-lg-4 mb-3">
                    <div className="card h-100">
                      <div className="card-body">
                        <div className="d-flex align-items-center mb-2">
                          <FaInfoCircle className="me-2 text-info" />
                          <small className="text-muted">{new Date(activity.date).toLocaleString()}</small>
                        </div>
                        <strong className="d-block mb-1">{activity.user}</strong>
                        <span className="badge bg-secondary mb-2">{activity.action}</span>
                        <p className="small mb-0 text-truncate" title={activity.details}>
                          {activity.details}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="card shadow-sm mb-4">
            <div className="card-header">
              <h6 className="mb-0">
                <FaFilter className="me-2" />
                Activity Logs Filter & Search
              </h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="input-group">
                    <span className="input-group-text"><FaSearch /></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <select
                    className="form-select"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                  >
                    <option value="">All Actions</option>
                    {uniqueActions.map(action => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <select
                    className="form-select"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                  >
                    <option value="">All Users</option>
                    {uniqueUsers.map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <small className="text-muted">
                  Showing {filteredLogs.length} of {logs.length} logs
                </small>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="card shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <FaEye className="me-2" />
                System Activity Logs
              </h6>
              <button className="btn btn-sm btn-outline-primary">
                <FaDownload className="me-1" />
                Export CSV
              </button>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Details</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-4">
                          <FaInfoCircle className="me-2" />
                          No logs match your filters
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.slice(0, 100).map((log, idx) => (
                        <tr key={idx}>
                          <td>
                            <small className="text-muted">
                              {new Date(log.date || log.timeStamp).toLocaleString()}
                            </small>
                          </td>
                          <td>
                            <strong>{log.user?.email || "System"}</strong>
                          </td>
                          <td>
                            <span className="badge bg-primary">{log.action}</span>
                          </td>
                          <td>
                            <div style={{ maxWidth: "300px" }} className="text-truncate" title={log.details}>
                              {log.details}
                            </div>
                          </td>
                          <td>
                            {log.action.includes("ERROR") ? (
                              <FaExclamationTriangle className="text-danger" />
                            ) : log.action.includes("LOGIN") || log.action.includes("UPLOAD") ? (
                              <FaCheckCircle className="text-success" />
                            ) : (
                              <FaInfoCircle className="text-info" />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredLogs.length > 100 && (
                <div className="card-footer text-center">
                  <small className="text-muted">
                    Showing first 100 logs. {filteredLogs.length - 100} more logs available.
                  </small>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
