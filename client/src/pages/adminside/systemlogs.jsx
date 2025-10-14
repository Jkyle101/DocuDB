// src/pages/SystemLogs.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaSyncAlt } from "react-icons/fa";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

import { BACKEND_URL } from "../../config";

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFiles: 0,
    totalFolders: 0,
    uploadsPerDay: [],
    actionsCount: [],
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
  }, []);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold">System Logs & Statistics</h4>
        <button
          className="btn btn-outline-primary"
          onClick={() => { fetchLogs(); fetchStats(); }}
          disabled={loading}
        >
          <FaSyncAlt className={loading ? "fa-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm p-3">
            <h6>Total Users</h6>
            <h3>{stats.totalUsers}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm p-3">
            <h6>Total Files</h6>
            <h3>{stats.totalFiles}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm p-3">
            <h6>Total Folders</h6>
            <h3>{stats.totalFolders}</h3>
          </div>
        </div>
      </div>

      {/* Graphs */}
      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card shadow-sm p-3">
            <h6>Uploads per Day</h6>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.uploadsPerDay}>
                <CartesianGrid stroke="#ccc" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="uploads" stroke="#007bff" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm p-3">
            <h6>Actions Breakdown</h6>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.actionsCount}
                  dataKey="count"
                  nameKey="action"
                  outerRadius={100}
                  fill="#8884d8"
                  label
                >
                  {stats.actionsCount.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="table-responsive shadow-sm">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center text-muted py-4">
                  No logs available
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr key={idx}>
                  <td>{new Date(log.date).toLocaleString()}</td>
                  <td>{log.user?.email || "System"}</td>
                  <td>
                    <span className="badge bg-info text-dark">{log.action}</span>
                  </td>
                  <td>{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
