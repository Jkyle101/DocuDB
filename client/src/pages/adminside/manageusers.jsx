import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { useOutletContext } from "react-router-dom";
import {
  FaEnvelope, FaSync, FaUsers, FaUserCheck, FaUserTimes, FaUserCog,
  FaSearch, FaFilter, FaUserPlus, FaUpload, FaFileExcel, FaFileCode,
  FaCalendarAlt, FaShieldAlt, FaUser, FaChartBar, FaCrown, FaKey, FaCheck, FaTimes
} from "react-icons/fa";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from "recharts";
import "bootstrap/dist/css/bootstrap.min.css";
import { BACKEND_URL } from "../../config";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [passwordRequests, setPasswordRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // User creation states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", role: "user" });
  const [bulkUsers, setBulkUsers] = useState([]);
  const [bulkImportResults, setBulkImportResults] = useState(null);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef(null);

  // Get user role and search results
  const role = localStorage.getItem("role") || "user";
  const userId = localStorage.getItem("userId");
  const { searchResults } = useOutletContext();

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/users`),
        axios.get(`${BACKEND_URL}/users/stats`)
      ]);
      setUsers(usersRes.data || []);
      setUserStats(statsRes.data || {});
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch password requests from backend
  const fetchPasswordRequests = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/admin/password-requests?role=${encodeURIComponent(role)}`);
      setPasswordRequests(response.data || []);
    } catch (err) {
      console.error("Failed to fetch password requests:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPasswordRequests();
  }, []);

  useEffect(() => {
    if (activeTab === "password-requests") {
      fetchPasswordRequests();
    }
  }, [activeTab]);

  // Get user initials for avatar
  const getUserInitials = (name, email) => {
    try {
      const displayName = name || (email && email.split('@')[0]) || "";
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    } catch (error) {
      return "U"; // Default to "U" for User if anything fails
    }
  };

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role) {
      case 'superadmin':
        return <FaCrown className="text-warning" />;
      case 'admin':
        return <FaShieldAlt className="text-danger" />;
      default:
        return <FaUser className="text-info" />;
    }
  };

  // Get role color
  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'warning';
      case 'admin':
        return 'danger';
      default:
        return 'info';
    }
  };

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchTerm ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = !roleFilter || user.role === roleFilter;
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
      roles[user.role] = (roles[user.role] || 0) + 1;
    });
    return Object.entries(roles).map(([role, count]) => ({
      name: role.charAt(0).toUpperCase() + role.slice(1),
      value: count,
      color: role === 'superadmin' ? '#ffc107' : role === 'admin' ? '#dc3545' : '#17a2b8'
    }));
  }, [users]);

  // Toggle Active / Inactive instead of deleting
  const toggleUserStatus = async (user) => {
    const isActive = user.active !== false;
    const newActive = !isActive;
    const confirmMsg = newActive
      ? `Activate ${user.email}?`
      : `Deactivate ${user.email}? This will prevent the user from logging in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.patch(`${BACKEND_URL}/users/${user._id}/status`, {
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
  const updateUserRole = async (userId, newRole) => {
    if (!window.confirm(`Change user role to ${newRole}?`)) return;

    try {
      await axios.patch(`${BACKEND_URL}/users/${userId}/role`, {
        role: newRole,
      });

      alert("User role updated successfully.");
      fetchUsers();
    } catch (err) {
      console.error("Failed to update user role:", err);
      alert("Failed to update role.");
    }
  };

  // Approve password change request
  const approvePasswordRequest = async (requestId) => {
    if (!window.confirm("Approve this password change request?")) return;

    try {
      await axios.patch(`${BACKEND_URL}/admin/password-requests/${requestId}/approve`, {
        adminId: userId
      });
      alert("Password change request approved successfully.");
      fetchPasswordRequests();
    } catch (err) {
      console.error("Failed to approve password request:", err);
      alert("Failed to approve password change request.");
    }
  };

  // Reject password change request
  const rejectPasswordRequest = async (requestId) => {
    if (!window.confirm("Reject this password change request?")) return;

    try {
      await axios.patch(`${BACKEND_URL}/admin/password-requests/${requestId}/reject`, {
        adminId: userId
      });
      alert("Password change request rejected.");
      fetchPasswordRequests();
    } catch (err) {
      console.error("Failed to reject password request:", err);
      alert("Failed to reject password change request.");
    }
  };

  // Add single user
  const addUser = async () => {
    if (!newUser.email || !newUser.password) {
      alert("Email and password are required.");
      return;
    }

    try {
      await axios.post(`${BACKEND_URL}/admin/users`, newUser);
      alert("User added successfully!");
      setNewUser({ email: "", password: "", name: "", role: "user" });
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
        return Array.isArray(data) ? data : [data];
      } else if (fileType.includes('csv') || fileType.includes('excel')) {
        // Simple CSV parsing (assuming first row is headers)
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const emailIndex = headers.indexOf('email');
        const passwordIndex = headers.indexOf('password');
        const nameIndex = headers.indexOf('name');

        if (emailIndex === -1 || passwordIndex === -1) {
          throw new Error("CSV must contain 'email' and 'password' columns");
        }

        return lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          return {
            email: values[emailIndex],
            password: values[passwordIndex],
            name: nameIndex >= 0 ? values[nameIndex] : '',
            role: 'user',
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
      const response = await axios.post(`${BACKEND_URL}/admin/users/bulk`, {
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

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            <FaUsers className="me-2 text-primary" />
            User Management Dashboard
          </h4>
          <small className="text-muted">Comprehensive user administration and analytics</small>
        </div>
        <button
          className="btn btn-outline-primary"
          onClick={fetchUsers}
          disabled={loading}
        >
          <FaSync className={loading ? "fa-spin me-2" : "me-2"} />
          Refresh
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
            <FaUserCog className="me-1" /> Manage Users
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "password-requests" ? "active" : ""}`}
            onClick={() => setActiveTab("password-requests")}
          >
            <FaKey className="me-1" /> Password Requests
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
                  <h5 className="card-title mb-1">{userStats.totalUsers || 0}</h5>
                  <small className="text-muted">Total Users</small>
                  <div className="mt-2">
                    <span className="badge bg-success">{userStats.activeUsers || 0} Active</span>
                    <span className="badge bg-secondary ms-1">{userStats.inactiveUsers || 0} Inactive</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm border-warning">
                <div className="card-body text-center">
                  <FaShieldAlt className="text-warning mb-2" size={32} />
                  <h5 className="card-title mb-1">{userStats.rolesCount?.admin || 0}</h5>
                  <small className="text-muted">Admins</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm border-info">
                <div className="card-body text-center">
                  <FaUser className="text-info mb-2" size={32} />
                  <h5 className="card-title mb-1">{userStats.rolesCount?.user || 0}</h5>
                  <small className="text-muted">Regular Users</small>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Registrations */}
          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaCalendarAlt className="me-2" />
                    Recent Registrations (Last 30 Days)
                  </h6>
                </div>
                <div className="card-body">
                  {userStats.recentUsers?.length > 0 ? (
                    <div className="list-group list-group-flush">
                      {userStats.recentUsers.slice(0, 5).map((user) => (
                        <div key={user._id} className="list-group-item d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center">
                            <div className="avatar-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px', borderRadius: '50%', fontSize: '14px', fontWeight: 'bold'}}>
                              {getUserInitials(user.name, user.email)}
                            </div>
                            <div>
                              <strong>{user.name || user.email.split('@')[0]}</strong>
                              <br />
                              <small className="text-muted">{user.email}</small>
                            </div>
                          </div>
                          <small className="text-muted">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted text-center py-3">No recent registrations</p>
                  )}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header">
                  <h6 className="mb-0">
                    <FaUsers className="me-2" />
                    Role Distribution
                  </h6>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={roleChartData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {roleChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Users Management Tab */}
      {activeTab === "users" && (
        <>
          {/* Search and Filters */}
          <div className="card shadow-sm mb-4">
            <div className="card-header">
              <h6 className="mb-0">
                <FaFilter className="me-2" />
                Search & Filter Users
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
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <select
                    className="form-select"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                </div>
                <div className="col-md-4">
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
              </div>
              <div className="mt-3">
                <small className="text-muted">
                  Showing {filteredUsers.length} of {users.length} users
                </small>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="card shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <FaUserCog className="me-2" />
                User Management
              </h6>
              <div className="dropdown">
                <button
                  className="btn btn-sm btn-outline-primary dropdown-toggle"
                  type="button"
                  id="addUserDropdown"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <FaUserPlus className="me-1" />
                  Add User
                </button>
                <ul className="dropdown-menu" aria-labelledby="addUserDropdown">
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => setShowAddUserModal(true)}
                    >
                      <FaUserPlus className="me-2" />
                      Add Single User
                    </button>
                  </li>
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => setShowBulkImportModal(true)}
                    >
                      <FaUpload className="me-2" />
                      Bulk Import Users
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          <FaUsers className="me-2" size={24} />
                          No users match your filters
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user._id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="avatar-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px', borderRadius: '50%', fontSize: '14px', fontWeight: 'bold'}}>
                                {getUserInitials(user.name, user.email)}
                              </div>
                              <div>
                                <strong className="text-primary">{user.name || "N/A"}</strong>
                              </div>
                            </div>
                          </td>
                          <td>
                            <a href={`mailto:${user.email}`} className="text-decoration-none">
                              <FaEnvelope className="me-1 text-muted" />
                              {user.email}
                            </a>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              {getRoleIcon(user.role)}
                              <select
                                className={`form-select form-select-sm ms-2 border-0 bg-transparent text-${getRoleColor(user.role)}`}
                                style={{width: 'auto'}}
                                value={user.role}
                                onChange={(e) => updateUserRole(user._id, e.target.value)}
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${user.active === false ? 'bg-secondary' : 'bg-success'}`}>
                              {user.active === false ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                          <td>
                            <small className="text-muted">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </small>
                          </td>
                          <td className="text-center">
                            <div className="btn-group">
                              {user.active !== false ? (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => toggleUserStatus(user)}
                                  title="Deactivate User"
                                >
                                  <FaUserTimes className="me-1" />
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => toggleUserStatus(user)}
                                  title="Activate User"
                                >
                                  <FaUserCheck className="me-1" />
                                  Activate
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
            </div>
          </div>
        </>
      )}

      {/* Password Requests Tab */}
      {activeTab === "password-requests" && (
        <div className="card shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">
              <FaKey className="me-2" />
              Password Change Requests
            </h6>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={fetchPasswordRequests}
            >
              <FaSync className="me-1" />
              Refresh
            </button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Request Date</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {passwordRequests.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        <FaKey className="me-2" size={24} />
                        No password change requests
                      </td>
                    </tr>
                  ) : (
                    passwordRequests.map((request) => (
                      <tr key={request._id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="avatar-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px', borderRadius: '50%', fontSize: '14px', fontWeight: 'bold'}}>
                              {getUserInitials(request.userId?.name, request.userId?.email)}
                            </div>
                            <div>
                              <strong className="text-primary">{request.userId?.name || "N/A"}</strong>
                            </div>
                          </div>
                        </td>
                        <td>
                          <a href={`mailto:${request.userId?.email}`} className="text-decoration-none">
                            <FaEnvelope className="me-1 text-muted" />
                            {request.userId?.email}
                          </a>
                        </td>
                        <td>
                          <small className="text-muted">
                            {new Date(request.createdAt).toLocaleDateString()}
                            <br />
                            {new Date(request.createdAt).toLocaleTimeString()}
                          </small>
                        </td>
                        <td>
                          <span className={`badge ${
                            request.status === 'pending' ? 'bg-warning' :
                            request.status === 'approved' ? 'bg-success' :
                            'bg-danger'
                          }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="text-center">
                          {request.status === 'pending' && (
                            <div className="btn-group">
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => approvePasswordRequest(request._id)}
                                title="Approve Password Change"
                              >
                                <FaCheck className="me-1" />
                                Approve
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => rejectPasswordRequest(request._id)}
                                title="Reject Password Change"
                              >
                                <FaTimes className="me-1" />
                                Reject
                              </button>
                            </div>
                          )}
                          {request.status === 'approved' && (
                            <span className="text-success">
                              <FaCheck className="me-1" />
                              Approved
                            </span>
                          )}
                          {request.status === 'rejected' && (
                            <span className="text-danger">
                              <FaTimes className="me-1" />
                              Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
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
                  disabled={!newUser.email || !newUser.password}
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
                  <strong>Required Columns:</strong> email, password
                  <br />
                  <strong>Optional Columns:</strong> name
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
                          </tr>
                        </thead>
                        <tbody>
                          {bulkUsers.slice(0, 10).map((user, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{user.email}</td>
                              <td>••••••••</td>
                              <td>{user.name || "—"}</td>
                              <td>{user.role}</td>
                            </tr>
                          ))}
                          {bulkUsers.length > 10 && (
                            <tr>
                              <td colSpan="5" className="text-muted text-center">
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
