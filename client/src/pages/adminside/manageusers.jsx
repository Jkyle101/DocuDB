import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  FaEnvelope, FaSync, FaUsers, FaUserCheck, FaUserTimes, FaUserCog,
  FaSearch, FaFilter, FaUserPlus,
  FaCalendarAlt, FaShieldAlt, FaUser, FaChartBar
} from "react-icons/fa";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from "recharts";
import "bootstrap/dist/css/bootstrap.min.css";
import { BACKEND_URL } from "../../config";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

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

  useEffect(() => {
    fetchUsers();
  }, []);

  // Get user initials for avatar
  const getUserInitials = (name, email) => {
    const displayName = name || email.split('@')[0];
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
              <button className="btn btn-sm btn-outline-primary">
                <FaUserPlus className="me-1" />
                Add User
              </button>
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


    </div>
  );
}
