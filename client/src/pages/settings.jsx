import React, { useState, useEffect } from "react";
import { FaUser, FaEnvelope, FaSave, FaKey, FaBell, FaShieldAlt, FaPalette, FaCamera, FaTrash } from "react-icons/fa";
import axios from "axios";
import { BACKEND_URL } from "../config";

function Settings() {
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    profilePicture: null
  });
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    darkMode: false,
    language: "en"
  });
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const userId = localStorage.getItem("userId");

  useEffect(() => {
    // Load user data
    const email = localStorage.getItem("email");
    const name = localStorage.getItem("name") || email?.split('@')[0] || "";
    setUserData(prev => ({ ...prev, email, name }));

    // Load preferences from localStorage
    const savedPrefs = localStorage.getItem(`userPreferences_${userId}`);
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        console.error("Error loading preferences:", e);
      }
    }
  }, [userId]);

  const showMessage = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  // Profile is now read-only - no update function needed

  const handlePasswordChangeRequest = async (e) => {
    e.preventDefault();

    if (userData.newPassword !== userData.confirmPassword) {
      showMessage("New passwords do not match.", "error");
      return;
    }

    if (userData.newPassword.length < 6) {
      showMessage("Password must be at least 6 characters long.", "error");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/user/password-request`, {
        userId,
        currentPassword: userData.currentPassword,
        newPassword: userData.newPassword
      });

      if (response.data.success) {
        setUserData(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        }));
        showMessage("Password change request submitted successfully! It will be reviewed by an administrator.");
      }
    } catch (error) {
      console.error("Password change request failed:", error);
      showMessage(error.response?.data?.message || "Failed to submit password change request.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = () => {
    localStorage.setItem(`userPreferences_${userId}`, JSON.stringify(preferences));
    showMessage("Preferences saved successfully!");
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        showMessage("Please select a valid image file (JPEG, PNG, GIF).", "error");
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showMessage("File size must be less than 5MB.", "error");
        return;
      }

      setProfilePictureFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setProfilePicturePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleProfilePictureUpload = async () => {
    if (!profilePictureFile) {
      showMessage("Please select a profile picture first.", "error");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('profilePicture', profilePictureFile);
      formData.append('userId', userId);

      const response = await axios.post(`${BACKEND_URL}/upload-profile-picture`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // Update local storage with new profile picture
        localStorage.setItem('profilePicture', response.data.profilePicture);
        setUserData(prev => ({ ...prev, profilePicture: response.data.profilePicture }));
        setProfilePictureFile(null);
        setProfilePicturePreview(null);
        showMessage("Profile picture updated successfully!");
        // Refresh the page to update all components
        window.location.reload();
      }
    } catch (error) {
      console.error("Profile picture upload failed:", error);
      showMessage(error.response?.data?.error || "Failed to upload profile picture.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!window.confirm("Are you sure you want to remove your profile picture?")) {
      return;
    }

    setLoading(true);

    try {
      // Update user profile picture to null
      const response = await axios.patch(`${BACKEND_URL}/users/${userId}`, {
        profilePicture: null
      });

      if (response.data) {
        localStorage.removeItem('profilePicture');
        setUserData(prev => ({ ...prev, profilePicture: null }));
        setProfilePicturePreview(null);
        showMessage("Profile picture removed successfully!");
        window.location.reload();
      }
    } catch (error) {
      console.error("Profile picture removal failed:", error);
      showMessage("Failed to remove profile picture.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <h2 className="mb-4">
            <FaUser className="me-2 text-primary" />
            Settings
          </h2>

          {/* Message Display */}
          {message && (
            <div className={`alert alert-${messageType === 'error' ? 'danger' : 'success'} alert-dismissible fade show`} role="alert">
              {message}
              <button type="button" className="btn-close" onClick={() => setMessage("")}></button>
            </div>
          )}

          {/* Settings Tabs */}
          <div className="card shadow-sm">
            <div className="card-header">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profile')}
                  >
                    <FaUser className="me-2" />
                    Profile
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'security' ? 'active' : ''}`}
                    onClick={() => setActiveTab('security')}
                  >
                    <FaShieldAlt className="me-2" />
                    Security
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'preferences' ? 'active' : ''}`}
                    onClick={() => setActiveTab('preferences')}
                  >
                    <FaPalette className="me-2" />
                    Preferences
                  </button>
                </li>
              </ul>
            </div>

            <div className="card-body">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div>
                  <h5 className="mb-3">Profile Picture</h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <div className="d-flex align-items-center">
                        <div className="profile-picture-container me-3">
                          {profilePicturePreview ? (
                            <img
                              src={profilePicturePreview}
                              alt="Profile Preview"
                              className="profile-picture-preview"
                            />
                          ) : userData.profilePicture ? (
                            <img
                              src={`${BACKEND_URL}/uploads/${userData.profilePicture}`}
                              alt="Current Profile"
                              className="profile-picture-preview"
                            />
                          ) : (
                            <div className="profile-picture-placeholder">
                              <FaUser size={40} />
                            </div>
                          )}
                        </div>
                        <div>
                          <input
                            type="file"
                            id="profilePicture"
                            accept="image/*"
                            onChange={handleProfilePictureChange}
                            className="d-none"
                          />
                          <label htmlFor="profilePicture" className="btn btn-outline-primary btn-sm me-2">
                            <FaCamera className="me-1" />
                            {profilePictureFile ? "Change" : "Upload"}
                          </label>
                          {profilePictureFile && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm me-2"
                              onClick={handleProfilePictureUpload}
                              disabled={loading}
                            >
                              <FaSave className="me-1" />
                              {loading ? "Uploading..." : "Save"}
                            </button>
                          )}
                          {(userData.profilePicture || profilePicturePreview) && (
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={handleRemoveProfilePicture}
                              disabled={loading}
                            >
                              <FaTrash className="me-1" />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <small className="text-muted d-block mt-2">
                        Upload a profile picture (JPEG, PNG, GIF). Max size: 5MB.
                      </small>
                    </div>
                  </div>

                  <h5 className="mb-3">Profile Information</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="name" className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        id="name"
                        value={userData.name}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="email" className="form-label">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        id="email"
                        value={userData.email}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">
                      Profile information cannot be modified. Contact your administrator if changes are needed.
                    </small>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <form onSubmit={handlePasswordChangeRequest}>
                  <h5 className="mb-3">Request Password Change</h5>
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label htmlFor="currentPassword" className="form-label">Current Password</label>
                      <input
                        type="password"
                        className="form-control"
                        id="currentPassword"
                        value={userData.currentPassword}
                        onChange={(e) => setUserData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="newPassword" className="form-label">New Password</label>
                      <input
                        type="password"
                        className="form-control"
                        id="newPassword"
                        value={userData.newPassword}
                        onChange={(e) => setUserData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                        minLength="6"
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                      <input
                        type="password"
                        className="form-control"
                        id="confirmPassword"
                        value={userData.confirmPassword}
                        onChange={(e) => setUserData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        minLength="6"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      <FaKey className="me-2" />
                      {loading ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </form>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div>
                  <h5 className="mb-3">User Preferences</h5>
                  <div className="row g-3">
                    <div className="col-md-12">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="emailNotifications"
                          checked={preferences.emailNotifications}
                          onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                        />
                        <label className="form-check-label" htmlFor="emailNotifications">
                          <FaBell className="me-2" />
                          Email Notifications
                        </label>
                        <small className="form-text text-muted d-block">
                          Receive email notifications for important updates and activities.
                        </small>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="darkMode"
                          checked={preferences.darkMode}
                          onChange={(e) => setPreferences(prev => ({ ...prev, darkMode: e.target.checked }))}
                        />
                        <label className="form-check-label" htmlFor="darkMode">
                          <FaPalette className="me-2" />
                          Dark Mode (Coming Soon)
                        </label>
                        <small className="form-text text-muted d-block">
                          Enable dark theme for better visibility in low light conditions.
                        </small>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button type="button" className="btn btn-primary" onClick={handlePreferencesUpdate}>
                      <FaSave className="me-2" />
                      Save Preferences
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
