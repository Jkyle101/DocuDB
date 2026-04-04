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
  BarChart,
  BarPlot,
  ChartsContainer,
  ChartsGrid,
  ChartsLegend,
  ChartsTooltip,
  ChartsXAxis,
  ChartsYAxis,
  LineChart,
  LinePlot,
  PieChart,
} from "@mui/x-charts";

import { BACKEND_URL } from "../../config";
import "./admin-analytics.css";

const EMPTY_STORAGE_INTEGRITY = {
  healthy: true,
  totalActiveFiles: 0,
  readableFilesCount: 0,
  directlyPresentCount: 0,
  fallbackRecoveredCount: 0,
  missingFilesCount: 0,
  likelyCause: "",
  sampleMissingFiles: [],
};

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const REFRESH_INTERVAL_MS = 12000;
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
    storageIntegrity: EMPTY_STORAGE_INTEGRITY,

    // Recent activity
    recentActivity: []
  });

  const refreshDashboard = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [logsRes, statsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/logs`),
        axios.get(`${BACKEND_URL}/stats`)
      ]);

      setLogs(logsRes.data || []);
      setStats({
        ...(statsRes.data || {}),
        storageIntegrity: statsRes.data?.storageIntegrity || EMPTY_STORAGE_INTEGRITY,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to refresh analytics dashboard:", err);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refreshDashboard();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshDashboard({ silent: true });
      }
    }, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDashboard({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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

  const errorLogsCount = logs.filter((log) => /error|failed|reject|denied/i.test(log.action || "")).length;
  const successLogsCount = logs.filter((log) => /login|upload|approve|create|restore|share/i.test(log.action || "")).length;
  const errorRate = logs.length > 0 ? ((errorLogsCount / logs.length) * 100).toFixed(1) : "0.0";
  const actionsPerActiveUser = stats.activeUsers > 0 ? (logs.length / stats.activeUsers).toFixed(1) : "0.0";
  const avgStoragePerUser = stats.totalUsers > 0 ? formatFileSize(stats.totalStorage / stats.totalUsers) : "0 B";
  const missingBlobsCount = stats.storageIntegrity?.missingFilesCount || 0;
  const liveStateText = refreshing ? "Syncing..." : `Live every ${Math.round(REFRESH_INTERVAL_MS / 1000)}s`;
  const lastUpdatedText = lastUpdated
    ? `Last updated ${lastUpdated.toLocaleTimeString()}`
    : "Fetching data...";

  const COLORS = ["#0a66ff", "#0f8fa7", "#f59e0b", "#7c3aed", "#ef4444", "#22c55e"];
  const chartMargin = { top: 24, right: 20, bottom: 36, left: 46 };
  const dualAxisChartMargin = { top: 24, right: 60, bottom: 36, left: 46 };
  const actionsPieTotal = stats.actionsCount.reduce((sum, entry) => sum + (entry?.count || 0), 0);
  const actionsPieData = stats.actionsCount.map((entry, index) => ({
    id: entry?.action || `action-${index}`,
    label: entry?.action || "Unknown",
    value: entry?.count || 0,
    color: COLORS[index % COLORS.length],
  }));
  const totalUploadCount = stats.uploadsPerDay.reduce((sum, entry) => sum + (entry?.uploads || 0), 0);
  const totalUploadSize = stats.uploadsPerDay.reduce((sum, entry) => sum + (entry?.size || 0), 0);
  const peakUploadDay = stats.uploadsPerDay.length > 0
    ? stats.uploadsPerDay.reduce(
      (peak, entry) => ((entry?.uploads || 0) > (peak?.uploads || 0) ? entry : peak),
      stats.uploadsPerDay[0]
    )
    : { date: "No uploads yet", uploads: 0, size: 0 };
  const totalRegistrations = stats.userRegistrations.reduce((sum, entry) => sum + (entry?.registrations || 0), 0);
  const peakRegistrationDay = stats.userRegistrations.length > 0
    ? stats.userRegistrations.reduce(
      (peak, entry) => ((entry?.registrations || 0) > (peak?.registrations || 0) ? entry : peak),
      stats.userRegistrations[0]
    )
    : { date: "No registrations yet", registrations: 0 };
  const topActions = [...actionsPieData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const topFileTypeBySize = stats.fileTypes.length > 0
    ? stats.fileTypes.reduce((peak, entry) => ((entry?.size || 0) > (peak?.size || 0) ? entry : peak), stats.fileTypes[0])
    : null;
  const topFileTypeByCount = stats.fileTypes.length > 0
    ? stats.fileTypes.reduce((peak, entry) => ((entry?.count || 0) > (peak?.count || 0) ? entry : peak), stats.fileTypes[0])
    : null;

  return (
    <div className="container-fluid py-3 admin-analytics-page">
      {/* Header */}
      <div className="analytics-hero mb-4">
        <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start align-items-xl-center gap-3">
          <div>
            <h4 className="fw-bold mb-1">
              <FaChartBar className="me-2 text-primary" />
              System Analytics Dashboard
            </h4>
            <small className="text-muted">Comprehensive system monitoring and activity insights</small>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className={`analytics-live-pill ${refreshing ? "is-refreshing" : "is-live"}`}>
              {liveStateText}
            </span>
            <small className="analytics-last-updated text-muted">{lastUpdatedText}</small>
            <button
              className="btn btn-outline-primary"
              onClick={() => refreshDashboard()}
              disabled={loading || refreshing}
            >
              <FaSyncAlt className={loading || refreshing ? "fa-spin me-2" : "me-2"} />
              Refresh Data
            </button>
          </div>
        </div>
        <div className="analytics-meta-strip mt-3">
          <span className="analytics-chip">Error rate: {errorRate}%</span>
          <span className="analytics-chip">Positive signals: {successLogsCount}</span>
          <span className="analytics-chip">Actions per active user: {actionsPerActiveUser}</span>
          <span className="analytics-chip">Avg storage per user: {avgStoragePerUser}</span>
          <span className="analytics-chip">Missing blobs: {missingBlobsCount}</span>
        </div>
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
          <div className="row g-4 mb-4">
            <div className="col-md-2">
              <div className="card shadow-sm border-primary analytics-kpi-card h-100">
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
              <div className="card shadow-sm border-success analytics-kpi-card h-100">
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
              <div className="card shadow-sm border-info analytics-kpi-card h-100">
                <div className="card-body text-center">
                  <FaFolder className="text-info mb-2" size={24} />
                  <h5 className="card-title mb-1">{stats.totalFolders}</h5>
                  <small className="text-muted">Total Folders</small>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card shadow-sm border-warning analytics-kpi-card h-100">
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
              <div className="card shadow-sm border-danger analytics-kpi-card h-100">
                <div className="card-body text-center">
                  <FaHdd className="text-danger mb-2" size={24} />
                  <h5 className="card-title mb-1">{formatFileSize(stats.totalStorage)}</h5>
                  <small className="text-muted">Total Storage</small>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card shadow-sm border-secondary analytics-kpi-card h-100">
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
                  <div className="analytics-chart-shell">
                    <ChartsContainer
                      dataset={stats.uploadsPerDay}
                      height={308}
                      margin={dualAxisChartMargin}
                      series={[
                        {
                          id: "uploads-per-day",
                          type: "bar",
                          dataKey: "uploads",
                          label: "Files Uploaded",
                          color: "#0a66ff",
                          yAxisId: "uploads-axis",
                          valueFormatter: (value) => `${value ?? 0} files`,
                        },
                        {
                          id: "upload-size-per-day",
                          type: "line",
                          dataKey: "size",
                          label: "Storage Used",
                          color: "#f59e0b",
                          curve: "monotoneX",
                          showMark: false,
                          yAxisId: "storage-axis",
                          valueFormatter: (value) => formatFileSize(Number(value) || 0),
                        },
                      ]}
                      xAxis={[{ id: "upload-dates", scaleType: "band", dataKey: "date" }]}
                      yAxis={[
                        { id: "uploads-axis", width: 40 },
                        {
                          id: "storage-axis",
                          position: "right",
                          width: 60,
                          valueFormatter: (value) => formatFileSize(Number(value) || 0),
                        },
                      ]}
                    >
                      <ChartsGrid horizontal />
                      <BarPlot />
                      <LinePlot />
                      <ChartsXAxis axisId="upload-dates" />
                      <ChartsYAxis axisId="uploads-axis" />
                      <ChartsYAxis axisId="storage-axis" />
                      <ChartsTooltip trigger="axis" />
                      <ChartsLegend />
                    </ChartsContainer>
                    <div className="analytics-chart-caption">
                      <span>{totalUploadCount} files uploaded</span>
                      <span>{formatFileSize(totalUploadSize)} stored in 30 days</span>
                      <span>Peak: {peakUploadDay.uploads || 0} on {peakUploadDay.date || "N/A"}</span>
                    </div>
                  </div>
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
                  <div className="analytics-chart-shell analytics-chart-shell--compact analytics-pie-stack">
                    <div className="analytics-pie-shell">
                      <PieChart
                        height={228}
                        hideLegend
                        margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
                        series={[{
                          data: actionsPieData,
                          innerRadius: 52,
                          outerRadius: 84,
                          paddingAngle: 2,
                          cornerRadius: 6,
                        }]}
                      />
                      <div className="analytics-pie-center">
                        <strong>{actionsPieTotal}</strong>
                        <span>actions</span>
                      </div>
                    </div>
                    {topActions.length > 0 ? (
                      <div className="analytics-breakdown-list">
                        {topActions.map((action) => (
                          <div key={action.id} className="analytics-breakdown-row">
                            <div className="analytics-breakdown-label">
                              <span className="analytics-breakdown-dot" style={{ background: action.color }}></span>
                              <span>{action.label}</span>
                            </div>
                            <strong>{action.value}</strong>
                            <small>
                              {actionsPieTotal > 0 ? `${Math.round((action.value / actionsPieTotal) * 100)}%` : "0%"}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="analytics-breakdown-list">
                        <div className="analytics-breakdown-row">
                          <div className="analytics-breakdown-label">
                            <span className="analytics-breakdown-dot" style={{ background: "#94a3b8" }}></span>
                            <span>No logged actions yet</span>
                          </div>
                          <strong>0</strong>
                          <small>0%</small>
                        </div>
                      </div>
                    )}
                  </div>
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
                  <div className="analytics-chart-shell">
                    <LineChart
                      dataset={stats.userRegistrations}
                      height={255}
                      margin={chartMargin}
                      grid={{ horizontal: true }}
                      hideLegend
                      xAxis={[{ id: "registration-dates", scaleType: "point", dataKey: "date" }]}
                      series={[{
                        id: "registrations",
                        dataKey: "registrations",
                        label: "Registrations",
                        area: true,
                        curve: "monotoneX",
                        color: "#22c55e",
                        showMark: false,
                        valueFormatter: (value) => `${value ?? 0} registrations`,
                      }]}
                    />
                    <div className="analytics-chart-caption">
                      <span>{totalRegistrations} total registrations</span>
                      <span>Peak day: {peakRegistrationDay.date || "N/A"}</span>
                    </div>
                  </div>
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
                  <div className="analytics-chart-shell">
                    <BarChart
                      dataset={stats.fileTypes}
                      height={255}
                      margin={chartMargin}
                      grid={{ horizontal: true }}
                      xAxis={[{ id: "file-types", scaleType: "band", dataKey: "type" }]}
                      series={[
                        {
                          id: "file-type-count",
                          dataKey: "count",
                          label: "Files",
                          color: "#0f8fa7",
                          valueFormatter: (value) => `${value ?? 0} files`,
                        },
                        {
                          id: "file-type-storage",
                          dataKey: "size",
                          label: "Storage",
                          color: "#7c3aed",
                          valueFormatter: (value) => formatFileSize(Number(value) || 0),
                        },
                      ]}
                    />
                    <div className="analytics-chart-caption">
                      <span>
                        Largest by files: {topFileTypeByCount ? `${topFileTypeByCount.type.toUpperCase()} (${topFileTypeByCount.count})` : "N/A"}
                      </span>
                      <span>
                        Largest by storage: {topFileTypeBySize ? `${topFileTypeBySize.type.toUpperCase()} (${formatFileSize(topFileTypeBySize.size)})` : "N/A"}
                      </span>
                    </div>
                  </div>
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
                <div className={`alert ${missingBlobsCount > 0 ? "alert-warning" : "alert-success"} d-flex align-items-start gap-3`}>
                  <div className="pt-1">
                    {missingBlobsCount > 0 ? (
                      <FaExclamationTriangle className="text-warning" />
                    ) : (
                      <FaCheckCircle className="text-success" />
                    )}
                  </div>
                  <div>
                    <strong>
                      {missingBlobsCount > 0
                        ? `Storage integrity issue detected: ${missingBlobsCount} file blob${missingBlobsCount === 1 ? "" : "s"} missing`
                        : "Storage integrity looks healthy"}
                    </strong>
                    <div className="small mt-1">
                      {missingBlobsCount > 0
                        ? (stats.storageIntegrity?.likelyCause || "Some file records exist in MongoDB, but their uploaded binaries are missing from server storage.")
                        : `All ${stats.storageIntegrity?.totalActiveFiles || 0} active file records resolved to readable storage.`}
                    </div>
                  </div>
                </div>
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
                      <h4 className={missingBlobsCount > 0 ? "text-danger" : "text-success"}>
                        {missingBlobsCount > 0 ? missingBlobsCount : (stats.storageIntegrity?.directlyPresentCount || 0)}
                      </h4>
                      <small className="text-muted">
                        {missingBlobsCount > 0 ? "Missing File Blobs" : "Readable File Blobs"}
                      </small>
                    </div>
                  </div>
                </div>

                {missingBlobsCount > 0 && (
                  <div className="mb-4">
                    <h6 className="mb-3">Missing File Samples</h6>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Stored Filename</th>
                            <th>Uploaded</th>
                            <th>Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(stats.storageIntegrity?.sampleMissingFiles || []).map((file) => (
                            <tr key={file._id || file.filename}>
                              <td>{file.originalName}</td>
                              <td><code>{file.filename}</code></td>
                              <td>{file.uploadDate ? new Date(file.uploadDate).toLocaleString() : "Unknown"}</td>
                              <td>{formatFileSize(file.size || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="analytics-chart-shell">
                  <BarChart
                    dataset={stats.fileTypes}
                    height={300}
                    margin={dualAxisChartMargin}
                    grid={{ horizontal: true }}
                    xAxis={[{ id: "storage-file-types", scaleType: "band", dataKey: "type" }]}
                    yAxis={[
                      { id: "storage-count-axis", width: 42 },
                      {
                        id: "storage-size-axis",
                        position: "right",
                        width: 60,
                        valueFormatter: (value) => formatFileSize(Number(value) || 0),
                      },
                    ]}
                    series={[
                      {
                        id: "storage-file-count",
                        dataKey: "count",
                        label: "File Count",
                        color: "#0a66ff",
                        yAxisId: "storage-count-axis",
                        valueFormatter: (value) => `${value ?? 0} files`,
                      },
                      {
                        id: "storage-file-size",
                        dataKey: "size",
                        label: "Storage Size",
                        color: "#14b8a6",
                        yAxisId: "storage-size-axis",
                        valueFormatter: (value) => formatFileSize(Number(value) || 0),
                      },
                    ]}
                  />
                  <div className="analytics-chart-caption">
                    <span>{stats.fileTypes.length} file types tracked</span>
                    <span>
                      Heaviest footprint: {topFileTypeBySize ? `${topFileTypeBySize.type.toUpperCase()} (${formatFileSize(topFileTypeBySize.size)})` : "N/A"}
                    </span>
                  </div>
                </div>
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
