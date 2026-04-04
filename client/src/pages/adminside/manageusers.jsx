import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import {
  FaEnvelope, FaSync, FaUsers, FaUserCheck, FaUserTimes, FaUserCog,
  FaSearch, FaFilter, FaUserPlus, FaUpload, FaFileExcel,
  FaUser, FaChartBar, FaCrown, FaCheck, FaSave
} from "react-icons/fa";
import { BarChart, PieChart } from "@mui/x-charts";
import "bootstrap/dist/css/bootstrap.min.css";
import { BACKEND_URL } from "../../config";
import "./admin-analytics.css";
import "./manageusers-glass.css";

const DEPARTMENT_OPTIONS = ["COED", "COT", "COHTM"];

const normalizeDepartment = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "UNASSIGNED") return "";
  if (DEPARTMENT_OPTIONS.includes(raw)) return raw;
  const collapsed = raw.replace(/[^A-Z0-9]/g, "");
  if (collapsed.includes("COED") || collapsed.includes("EDUCATION")) return "COED";
  if (collapsed.includes("COHTM") || collapsed.includes("HOSPITALITY") || collapsed.includes("TOURISM")) return "COHTM";
  if (collapsed.includes("COT") || collapsed.includes("TECHNOLOGY")) return "COT";
  return "";
};

const formatRoleName = (role) => {
  const labels = {
    user: "User",
    dept_chair: "Dept Chair",
    qa_admin: "QA Admin",
    evaluator: "Evaluator",
    superadmin: "Super Admin",
  };

  return labels[role] || String(role || "Unknown")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function ManageUsers() {
  const roleOptions = [
    { value: "user", label: "User" },
    { value: "dept_chair", label: "Dept Chair" },
    { value: "qa_admin", label: "QA Admin" },
    { value: "evaluator", label: "Evaluator" },
    { value: "superadmin", label: "Super Admin" },
  ];
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const REFRESH_INTERVAL_MS = 12000;

  // User creation states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", department: "", role: "user" });
  const [bulkUsers, setBulkUsers] = useState([]);
  const [bulkImportResults, setBulkImportResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [savingUserId, setSavingUserId] = useState("");

  const fileInputRef = useRef(null);

  // Get user role
  const role = localStorage.getItem("role") || "superadmin";
  const userId = localStorage.getItem("userId");
  const normalizeRole = (value) => {
    const raw = String(value || "").toLowerCase();
    if (raw === "admin") return "superadmin";
    if (raw === "faculty") return "user";
    if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
    if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
    if (raw === "reviewer") return "evaluator";
    return raw;
  };

  const refreshDashboard = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/users?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || "")}`),
        axios.get(`${BACKEND_URL}/users/stats?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || "")}`)
      ]);

      const userRows = Array.isArray(usersRes.data) ? usersRes.data : [];
      setUsers(
        userRows.map((user) => ({
          ...user,
          department: normalizeDepartment(user?.department),
        }))
      );
      setUserStats(statsRes.data || {});
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to refresh user dashboard:", err);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Fetch users from backend
  const fetchUsers = async () => {
    await refreshDashboard();
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshDashboard({ silent: true });
      }
    };

    const interval = setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  // Get user initials for avatar
  const getUserInitials = (name, email) => {
    try {
      const displayName = name || (email && email.split('@')[0]) || "";
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    } catch {
      return "U"; // Default to "U" for User if anything fails
    }
  };

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role) {
      case 'superadmin':
        return <FaCrown className="text-warning" />;
      case 'dept_chair':
        return <FaUserCog className="text-primary" />;
      case 'qa_admin':
        return <FaCheck className="text-success" />;
      default:
        return <FaUser className="text-info" />;
    }
  };

  // Get role color
  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'warning';
      case 'dept_chair':
        return 'primary';
      case 'qa_admin':
        return 'success';
      default:
        return 'info';
    }
  };

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchTerm ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = !roleFilter || normalizeRole(user.role) === roleFilter;
      const matchesStatus = !statusFilter ||
        (statusFilter === 'active' && user.active !== false) ||
        (statusFilter === 'inactive' && user.active === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Prepare chart data
  const roleChartData = useMemo(() => {
    const roles = {};
    users.forEach(user => {
      const normalized = normalizeRole(user.role);
      roles[normalized] = (roles[normalized] || 0) + 1;
    });
    return Object.entries(roles).map(([role, count]) => ({
      name: formatRoleName(role),
      value: count,
      color: role === 'superadmin'
        ? '#ffc107'
        : role === 'dept_chair'
            ? '#0d6efd'
            : role === 'qa_admin'
              ? '#198754'
        : '#17a2b8'
    }));
  }, [users]);

  const rolePieData = useMemo(
    () => roleChartData.map((entry) => ({
      id: entry.name,
      label: entry.name,
      value: entry.value,
      color: entry.color,
    })),
    [roleChartData]
  );
  const totalRoleUsers = rolePieData.reduce((sum, item) => sum + item.value, 0);

  const activeRate = userStats.totalUsers
    ? ((userStats.activeUsers || 0) / userStats.totalUsers * 100).toFixed(1)
    : "0.0";
  const liveStateText = refreshing ? "Syncing..." : `Live every ${Math.round(REFRESH_INTERVAL_MS / 1000)}s`;
  const lastUpdatedText = lastUpdated
    ? `Last updated ${lastUpdated.toLocaleTimeString()}`
    : "Fetching data...";

  // Toggle Active / Inactive instead of deleting
  const toggleUserStatus = async (user) => {
    const isActive = user.active !== false;
    const newActive = !isActive;
    const confirmMsg = newActive
      ? `Activate ${user.email}?`
      : `Deactivate ${user.email}? This will prevent the user from logging in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.patch(`${BACKEND_URL}/users/${user._id}/status?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || "")}`, {
        active: newActive,
      });

      alert(`${user.email} is now ${newActive ? "active" : "deactivated"}.`);
      fetchUsers();
    } catch (err) {
      console.error("Failed to update user status:", err);
      alert("Failed to update status. Please check your connection or backend.");
    }
  };

  // Update user role
  const updateUserRole = async (targetUserId, newRole) => {
    if (!window.confirm(`Change user role to ${newRole}?`)) return;

    try {
      await axios.patch(`${BACKEND_URL}/users/${targetUserId}/role?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || "")}`, {
        role: newRole,
      });

      alert("User role updated successfully.");
      fetchUsers();
    } catch (err) {
      console.error("Failed to update user role:", err);
      alert("Failed to update role.");
    }
  };

  const updateUserFieldDraft = (targetUserId, field, value) => {
    setUsers((prev) =>
      prev.map((u) =>
        String(u._id) === String(targetUserId)
          ? { ...u, [field]: value }
          : u
      )
    );
  };

  const updateUserDetails = async (user) => {
    const nextName = String(user?.name || "").trim();
    const nextDepartment = normalizeDepartment(user?.department);
    if (!nextDepartment) {
      alert(`Department must be one of: ${DEPARTMENT_OPTIONS.join(", ")}`);
      return;
    }

    setSavingUserId(String(user._id));
    try {
      await axios.patch(
        `${BACKEND_URL}/users/${user._id}`,
        {
          userId,
          role,
          name: nextName,
          department: nextDepartment,
        },
        {
          params: {
            role,
            userId: userId || "",
            name: nextName,
            department: nextDepartment,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      alert("User details updated.");
      fetchUsers();
    } catch (err) {
      console.error("Failed to update user details:", err);
      alert(err.response?.data?.error || "Failed to update user details.");
    } finally {
      setSavingUserId("");
    }
  };

  // Add single user
  const addUser = async () => {
    if (!newUser.email || !newUser.password) {
      alert("Email and password are required.");
      return;
    }
    const normalizedDepartment = normalizeDepartment(newUser.department);
    if (!normalizedDepartment) {
      alert(`Department must be one of: ${DEPARTMENT_OPTIONS.join(", ")}`);
      return;
    }

    try {
      await axios.post(
        `${BACKEND_URL}/admin/users?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || "")}`,
        { ...newUser, department: normalizedDepartment }
      );
      alert("User added successfully!");
      setNewUser({ email: "", password: "", name: "", department: "", role: "user" });
      setShowAddUserModal(false);
      fetchUsers();
    } catch (err) {
      console.error("Failed to add user:", err);
      alert(err.response?.data?.error || "Failed to add user.");
    }
  };

  // Handle file upload for bulk import
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/json',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a JSON, CSV, or Excel file.");
      return;
    }

    try {
      const fileContent = await readFileContent(file);
      const parsedUsers = parseUserData(fileContent, file.type);
      setBulkUsers(parsedUsers);
    } catch (err) {
      console.error("Error reading file:", err);
      alert("Error reading file. Please check the format.");
    }
  };

  // Read file content
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Parse user data from different file formats
  const parseUserData = (content, fileType) => {
    try {
      if (fileType === 'application/json') {
        const data = JSON.parse(content);
        const rows = Array.isArray(data) ? data : [data];
        return rows.map((row, index) => ({
          ...row,
          role: row?.role || "user",
          department: normalizeDepartment(row?.department),
          lineNumber: row?.lineNumber || index + 1
        }));
      } else if (fileType.includes('csv') || fileType.includes('excel')) {
        // Simple CSV parsing (assuming first row is headers)
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const emailIndex = headers.indexOf('email');
        const passwordIndex = headers.indexOf('password');
        const nameIndex = headers.indexOf('name');
        const roleIndex = headers.indexOf('role');
        const departmentIndex = headers.indexOf('department');

        if (emailIndex === -1 || passwordIndex === -1) {
          throw new Error("CSV must contain 'email' and 'password' columns");
        }

        return lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          return {
            email: values[emailIndex],
            password: values[passwordIndex],
            name: nameIndex >= 0 ? values[nameIndex] : '',
            department: normalizeDepartment(departmentIndex >= 0 ? values[departmentIndex] : ''),
            role: roleIndex >= 0 ? values[roleIndex] || "user" : "user",
            lineNumber: index + 2
          };
        });
      }
      throw new Error("Unsupported file format");
    } catch (err) {
      throw new Error(`Error parsing file: ${err.message}`);
    }
  };

  // Bulk import users
  const bulkImportUsers = async () => {
    if (bulkUsers.length === 0) return;

    setImporting(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/admin/users/bulk?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || "")}`, {
        users: bulkUsers
      });

      setBulkImportResults(response.data);
      alert(`Bulk import completed! ${response.data.successful} users added, ${response.data.failed} failed.`);

      // Reset form
      setBulkUsers([]);
      setBulkImportResults(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowBulkImportModal(false);
      fetchUsers();
    } catch (err) {
      console.error("Bulk import failed:", err);
      alert(err.response?.data?.error || "Bulk import failed.");
    } finally {
      setImporting(false);
    }
  };

  // Reset bulk import
  const resetBulkImport = () => {
    setBulkUsers([]);
    setBulkImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeUsersCount = useMemo(
    () => users.filter((user) => user.active !== false).length,
    [users]
  );
  const inactiveUsersCount = Math.max(0, users.length - activeUsersCount);

  const departmentStats = useMemo(() => {
    const buckets = { COED: 0, COT: 0, COHTM: 0, Unassigned: 0 };
    users.forEach((user) => {
      const normalized = normalizeDepartment(user?.department);
      if (normalized) {
        buckets[normalized] += 1;
      } else {
        buckets.Unassigned += 1;
      }
    });

    const total = users.length || 1;
    return Object.entries(buckets).map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
    }));
  }, [users]);
  const leadingRole = roleChartData.length > 0
    ? roleChartData.reduce((peak, entry) => (entry.value > peak.value ? entry : peak), roleChartData[0])
    : { name: "No roles", value: 0 };
  const leadingDepartment = departmentStats.length > 0
    ? departmentStats.reduce((peak, entry) => (entry.count > peak.count ? entry : peak), departmentStats[0])
    : { name: "No departments", count: 0 };
  const roleBreakdownData = useMemo(
    () => [...roleChartData].sort((a, b) => b.value - a.value),
    [roleChartData]
  );

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("");
    setStatusFilter("");
  };

  const exportUsersCsv = () => {
    const sourceRows = filteredUsers.length > 0 ? filteredUsers : users;
    if (!sourceRows.length) {
      alert("No users available to export.");
      return;
    }

    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = ["Name", "Email", "Department", "Role", "Status", "Joined"];
    const rows = sourceRows.map((user) => [
      user?.name || "",
      user?.email || "",
      normalizeDepartment(user?.department) || "Unassigned",
      normalizeRole(user?.role),
      user?.active === false ? "Inactive" : "Active",
      user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `users-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-fluid py-3 admin-analytics-page user-management-dashboard">
      <div className="um-shell">
        <section className="um-header">
          <div className="um-header-top">
            <div>
              <p className="um-eyebrow mb-1">DIRECTORY CONTROL</p>
              <h2 className="um-title mb-2">User Management</h2>
              <p className="um-subtitle mb-0">
                Manage organization roles, permissions, and directory access.
              </p>
            </div>
            <div className="um-header-actions">
              <button
                className="btn btn-outline-primary"
                onClick={exportUsersCsv}
                disabled={users.length === 0}
              >
                <FaFileExcel className="me-2" /> Export CSV
              </button>
              <div className="dropdown">
                <button
                  className="btn btn-primary dropdown-toggle"
                  type="button"
                  id="headerAddUserDropdown"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <FaUserPlus className="me-2" /> Add User
                </button>
                <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="headerAddUserDropdown">
                  <li>
                    <button className="dropdown-item" onClick={() => setShowAddUserModal(true)}>
                      <FaUserPlus className="me-2" /> Add Single User
                    </button>
                  </li>
                  <li>
                    <button className="dropdown-item" onClick={() => setShowBulkImportModal(true)}>
                      <FaUpload className="me-2" /> Bulk Import Users
                    </button>
                  </li>
                </ul>
              </div>
              <button
                className="btn btn-outline-primary"
                onClick={() => refreshDashboard()}
                disabled={loading || refreshing}
              >
                <FaSync className={loading || refreshing ? "fa-spin me-2" : "me-2"} />
                Refresh
              </button>
            </div>
          </div>

          <div className="um-search-strip">
            <div className="um-search-box">
              <FaSearch className="um-search-icon" />
              <input
                type="text"
                className="form-control um-search-input"
                placeholder="Search users, roles, or departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn btn-link um-reset-btn" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>

          <div className="analytics-meta-strip mt-3">
            <span className={`analytics-live-pill ${refreshing ? "is-refreshing" : "is-live"}`}>
              {liveStateText}
            </span>
            <small className="analytics-last-updated text-muted">{lastUpdatedText}</small>
            <span className="analytics-chip">Active rate: {activeRate}%</span>
            <span className="analytics-chip">Inactive users: {inactiveUsersCount}</span>
            <span className="analytics-chip">Visible users: {filteredUsers.length}</span>
          </div>

          <div className="um-tab-strip" role="tablist" aria-label="User management views">
            <button
              className={`um-tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
              role="tab"
              aria-selected={activeTab === "overview"}
            >
              <FaChartBar className="me-2" /> Overview
            </button>
            <button
              className={`um-tab-btn ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
              role="tab"
              aria-selected={activeTab === "users"}
            >
              <FaUserCog className="me-2" /> Manage Users
            </button>
          </div>
        </section>

        {activeTab === "overview" && (
          <section className="um-view-stack">
            <div className="row g-4">
              <div className="col-xl-8">
                <article className="um-glass-card um-snapshot-card h-100">
                  <div className="um-card-head">
                    <h6 className="mb-1">Directory Snapshot</h6>
                    <small className="text-muted">Overview of account health and role coverage.</small>
                  </div>
                  <div className="um-kpi-grid">
                    <div className="um-kpi-item is-blue">
                      <small>Total Users</small>
                      <h4>{userStats.totalUsers || 0}</h4>
                    </div>
                    <div className="um-kpi-item is-green">
                      <small>Active</small>
                      <h4>{activeUsersCount}</h4>
                    </div>
                    <div className="um-kpi-item is-slate">
                      <small>Inactive</small>
                      <h4>{inactiveUsersCount}</h4>
                    </div>
                    <div className="um-kpi-item is-amber">
                      <small>Super Admins</small>
                      <h4>{userStats.rolesCount?.superadmin || 0}</h4>
                    </div>
                    <div className="um-kpi-item is-cyan">
                      <small>Dept Chairs</small>
                      <h4>{userStats.rolesCount?.dept_chair || 0}</h4>
                    </div>
                    <div className="um-kpi-item is-purple">
                      <small>QA Admins</small>
                      <h4>{userStats.rolesCount?.qa_admin || 0}</h4>
                    </div>
                  </div>
                  <div className="um-role-chip-wrap">
                    {roleChartData.length > 0 ? (
                      roleChartData.map((entry) => (
                        <span
                          key={entry.name}
                          className="um-role-chip"
                          style={{
                            borderColor: `${entry.color}55`,
                            background: `${entry.color}1A`,
                            color: entry.color,
                          }}
                        >
                          <span className="um-role-dot" style={{ background: entry.color }}></span>
                          {entry.name}: {entry.value}
                        </span>
                      ))
                    ) : (
                      <small className="text-muted">No role data available.</small>
                    )}
                  </div>
                </article>
              </div>
              <div className="col-xl-4">
                <article className="um-glass-card um-donut-card h-100">
                  <div className="um-card-head">
                    <h6 className="mb-1">Role Distribution</h6>
                    <small className="text-muted">Current allocation by role.</small>
                  </div>
                  {roleChartData.some((item) => item.value > 0) ? (
                    <>
                      <div className="analytics-chart-shell um-donut-shell analytics-pie-stack">
                        <div className="analytics-pie-shell">
                          <PieChart
                            height={228}
                            hideLegend
                            margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
                            series={[{
                              data: rolePieData,
                              innerRadius: 60,
                              outerRadius: 86,
                              paddingAngle: 2,
                              cornerRadius: 6,
                            }]}
                          />
                          <div className="analytics-pie-center">
                            <strong>{totalRoleUsers}</strong>
                            <span>accounts</span>
                          </div>
                        </div>
                        <div className="analytics-breakdown-list">
                          {roleBreakdownData.map((role) => (
                            <div key={role.name} className="analytics-breakdown-row">
                              <div className="analytics-breakdown-label">
                                <span className="analytics-breakdown-dot" style={{ background: role.color }}></span>
                                <span>{role.name}</span>
                              </div>
                              <strong>{role.value}</strong>
                              <small>
                                {totalRoleUsers > 0 ? `${Math.round((role.value / totalRoleUsers) * 100)}%` : "0%"}
                              </small>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="um-chart-summary">
                        <span>Largest role</span>
                        <strong>{leadingRole.name} ({leadingRole.value})</strong>
                      </div>
                    </>
                  ) : (
                    <div className="um-empty-inline">No users yet.</div>
                  )}
                </article>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-xl-8">
                <article className="um-glass-card h-100">
                  <div className="um-card-head">
                    <h6 className="mb-1">Recent Registrations</h6>
                    <small className="text-muted">Latest users added to the system.</small>
                  </div>
                  <div className="um-recent-list">
                    {userStats.recentUsers?.length > 0 ? (
                      userStats.recentUsers.slice(0, 6).map((user) => (
                        <div key={user._id} className="um-recent-item">
                          <div className="um-recent-avatar">
                            {getUserInitials(user.name, user.email)}
                          </div>
                          <div className="um-recent-content">
                            <strong>{user.name || user.email?.split("@")[0]}</strong>
                            <p className="mb-0">{user.email}</p>
                          </div>
                          <small className="text-muted">{new Date(user.createdAt).toLocaleDateString()}</small>
                        </div>
                      ))
                    ) : (
                      <div className="um-empty-inline">No recent registrations.</div>
                    )}
                  </div>
                </article>
              </div>
              <div className="col-xl-4">
                <article className="um-glass-card um-dept-card h-100">
                  <div className="um-card-head">
                    <h6 className="mb-1">Department Coverage</h6>
                    <small className="text-muted">Distribution across departments.</small>
                  </div>
                  <div className="analytics-chart-shell analytics-chart-shell--compact">
                    <BarChart
                      dataset={departmentStats}
                      height={205}
                      margin={{ top: 20, right: 18, bottom: 36, left: 40 }}
                      grid={{ horizontal: true }}
                      xAxis={[{ id: "department-coverage", scaleType: "band", dataKey: "name" }]}
                      series={[{
                        id: "department-users",
                        dataKey: "count",
                        label: "Users",
                        color: "#0a66ff",
                        valueFormatter: (value) => `${value ?? 0} users`,
                      }]}
                    />
                  </div>
                  <div className="um-chart-summary">
                    <span>Coverage leader</span>
                    <strong>{leadingDepartment.name} ({leadingDepartment.count})</strong>
                  </div>
                  <div className="um-dept-list">
                    {departmentStats.map((item) => (
                      <div key={item.name} className="um-dept-item">
                        <div className="d-flex justify-content-between">
                          <span>{item.name}</span>
                          <strong>{item.count}</strong>
                        </div>
                        <div className="progress">
                          <div className="progress-bar" style={{ width: `${item.percent}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>

            <div className="um-insight-grid">
              <article className="um-insight-card">
                <small>Growth</small>
                <h4>{activeRate}%</h4>
                <p className="mb-0">active users in current cycle</p>
              </article>
              <article className="um-insight-card">
                <small>Security</small>
                <h4>{userStats.rolesCount?.superadmin || 0}</h4>
                <p className="mb-0">super admin accounts</p>
              </article>
              <article className="um-insight-card">
                <small>Pending</small>
                <h4>{bulkUsers.length}</h4>
                <p className="mb-0">users staged for import</p>
              </article>
            </div>
          </section>
        )}

        {activeTab === "users" && (
          <section className="um-view-stack">
            <article className="um-glass-card um-filter-card">
              <div className="um-card-head d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h6 className="mb-0">
                  <FaFilter className="me-2" /> Search & Filter Users
                </h6>
                <button className="btn btn-link um-reset-btn p-0" onClick={resetFilters}>
                  Reset Filters
                </button>
              </div>
              <div className="row g-3 mt-1">
                <div className="col-lg-5">
                  <div className="um-inline-search">
                    <FaSearch className="um-search-icon" />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Filter by name, email, or department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-lg-3">
                  <select
                    className="form-select"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">All Roles</option>
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-lg-3">
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="col-lg-1 d-flex align-items-stretch">
                  <button className="btn btn-outline-secondary w-100" onClick={resetFilters} title="Reset filters">
                    <FaSync />
                  </button>
                </div>
              </div>
              <small className="text-muted d-block mt-3">
                Showing {filteredUsers.length} of {users.length} users
              </small>
            </article>

            <article className="um-glass-card um-table-card">
              <div className="um-table-head">
                <div>
                  <h6 className="mb-1">User Directory</h6>
                  <small className="text-muted">Edit user profiles, assign roles, and control account access.</small>
                </div>
                <div className="um-table-head-actions">
                  <button className="btn btn-outline-primary" onClick={() => setShowAddUserModal(true)}>
                    <FaUserPlus className="me-2" /> Add User
                  </button>
                  <button className="btn btn-outline-secondary" onClick={() => setShowBulkImportModal(true)}>
                    <FaUpload className="me-2" /> Bulk Import
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table align-middle mb-0 um-user-table">
                  <thead>
                    <tr>
                      <th>User / Name</th>
                      <th>Contact Info</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined Date</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          <FaUsers className="me-2" size={22} /> No users match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user._id}>
                          <td>
                            <div className="um-user-cell">
                              <div className="um-user-avatar">{getUserInitials(user.name, user.email)}</div>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={user.name || ""}
                                onChange={(e) => updateUserFieldDraft(user._id, "name", e.target.value)}
                                placeholder="Full name"
                              />
                            </div>
                          </td>
                          <td>
                            <a href={`mailto:${user.email}`} className="um-email-link">
                              <FaEnvelope className="me-1" /> {user.email}
                            </a>
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={user.department || ""}
                              onChange={(e) => updateUserFieldDraft(user._id, "department", e.target.value)}
                            >
                              <option value="">Select department</option>
                              {DEPARTMENT_OPTIONS.map((dep) => (
                                <option key={dep} value={dep}>{dep}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="um-role-cell">
                              {getRoleIcon(normalizeRole(user.role))}
                              <select
                                className="form-select form-select-sm um-role-select"
                                value={normalizeRole(user.role)}
                                onChange={(e) => updateUserRole(user._id, e.target.value)}
                              >
                                {roleOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td>
                            <span className={`um-status-pill ${user.active === false ? "inactive" : "active"}`}>
                              {user.active === false ? "Inactive" : "Active"}
                            </span>
                          </td>
                          <td>
                            <small className="text-muted">{new Date(user.createdAt).toLocaleDateString()}</small>
                          </td>
                          <td className="text-center">
                            <div className="um-action-stack">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => updateUserDetails(user)}
                                disabled={savingUserId === String(user._id)}
                                title="Save name and department"
                              >
                                <FaSave className="me-1" />
                                {savingUserId === String(user._id) ? "Saving..." : "Save"}
                              </button>
                              {user.active !== false ? (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => toggleUserStatus(user)}
                                  title="Deactivate User"
                                >
                                  <FaUserTimes className="me-1" /> Deactivate
                                </button>
                              ) : (
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => toggleUserStatus(user)}
                                  title="Activate User"
                                >
                                  <FaUserCheck className="me-1" /> Activate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="um-table-footer">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </article>
          </section>
        )}
      </div>
      {/* Add Single User Modal */}
      {showAddUserModal && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaUserPlus className="me-2" />
                  Add New User
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddUserModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <form onSubmit={(e) => { e.preventDefault(); addUser(); }}>
                  <div className="mb-3">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Enter password"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Full Name (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Department</label>
                    <select
                      className="form-select"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      required
                    >
                      <option value="">Select department</option>
                      {DEPARTMENT_OPTIONS.map((dep) => (
                        <option key={dep} value={dep}>
                          {dep}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={addUser}
                  disabled={!newUser.email || !newUser.password || !newUser.department.trim()}
                >
                  <FaUserPlus className="me-2" />
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaUpload className="me-2" />
                  Bulk Import Users
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowBulkImportModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <strong>Supported Formats:</strong> JSON, CSV, Excel files
                  <br />
                  <strong>Required Columns:</strong> email, password, department
                  <br />
                  <strong>Optional Columns:</strong> name, role
                  <br />
                  <strong>Default Role:</strong> user
                </div>

                <div className="mb-3">
                  <label className="form-label">Upload File</label>
                  <input
                    type="file"
                    className="form-control"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json,.csv,.xlsx,.xls"
                  />
                </div>

                {bulkUsers.length > 0 && (
                  <div className="mb-3">
                    <h6>Preview ({bulkUsers.length} users)</h6>
                    <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Email</th>
                            <th>Password</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Department</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkUsers.slice(0, 10).map((user, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{user.email}</td>
                              <td>********</td>
                              <td>{user.name || "-"}</td>
                              <td>{user.role}</td>
                              <td>{user.department || "Missing"}</td>
                            </tr>
                          ))}
                          {bulkUsers.length > 10 && (
                            <tr>
                              <td colSpan="6" className="text-muted text-center">
                                ... and {bulkUsers.length - 10} more users
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {bulkImportResults && (
                  <div className="mb-3">
                    <h6>Import Results</h6>
                    <div className="alert alert-success">
                      <strong>Success:</strong> {bulkImportResults.successful} users added
                    </div>
                    {bulkImportResults.failed > 0 && (
                      <div className="alert alert-warning">
                        <strong>Failed:</strong> {bulkImportResults.failed} users failed to import
                        {bulkImportResults.errors && (
                          <ul className="mt-2 mb-0">
                            {bulkImportResults.errors.slice(0, 5).map((error, index) => (
                              <li key={index} className="small">{error}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={resetBulkImport}
                >
                  Reset
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowBulkImportModal(false)}
                >
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={bulkImportUsers}
                  disabled={bulkUsers.length === 0 || importing}
                >
                  {importing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Importing...
                    </>
                  ) : (
                    <>
                      <FaUpload className="me-2" />
                      Import {bulkUsers.length} Users
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


