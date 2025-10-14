import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaEnvelope, FaCheck, FaTimes, FaBolt } from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";
import { BACKEND_URL } from "../../config";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/users`);
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Delete user (example action)
  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/users/${id}`);
      setUsers(users.filter((u) => u._id !== id));
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  return (
    <div className="container py-4">
      <h3 className="fw-bold mb-4">Manage Users</h3>

      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map((user, index) => (
                <tr key={user._id}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="fw-semibold text-primary" role="button">
                      {user.name || "N/A"}
                    </span>
                  </td>
                  <td>
                    <a href={`mailto:${user.email}`} className="text-decoration-none">
                      <FaEnvelope className="me-1 text-muted" />
                      {user.email}
                    </a>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        user.role === "superadmin"
                          ? "bg-success"
                          : user.role === "admin"
                          ? "bg-danger"
                          : "bg-info"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  
                  <td className="text-center">
                    <div className="btn-group">
                      
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteUser(user._id)}
                      >
                        <FaTimes className="me-1" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted py-4">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
