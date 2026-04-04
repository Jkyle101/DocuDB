import React, { useState, useEffect } from "react";
import { FaUser, FaEnvelope, FaSave, FaKey, FaBell, FaShieldAlt, FaPalette, FaCamera, FaTrash, FaEye, FaEyeSlash } from "react-icons/fa";
import axios from "axios";
import { BACKEND_URL, buildUploadUrl } from "../config";

const DEPARTMENT_OPTIONS = ["COED", "COT", "COHTM"];
const PROFILE_PICTURE_EVENT = "profile-picture-updated";

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

const dispatchProfilePictureUpdated = (profilePicture, updatedAt = Date.now()) => {
  try {
    window.dispatchEvent(
      new CustomEvent(PROFILE_PICTURE_EVENT, {
        detail: {
          profilePicture: profilePicture || null,
          updatedAt,
        },
      })
    );
  } catch (err) {
    console.error("Failed to dispatch profile picture event:", err);
  }
};

function Settings() {
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    department: "",
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
  const [profilePictureVersion, setProfilePictureVersion] = useState(
    Number(localStorage.getItem("profilePictureUpdatedAt") || 0)
  );
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false
  });
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [passwordResetCode, setPasswordResetCode] = useState("");

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "user";

  useEffect(() => {
    const email = localStorage.getItem("email");
    const name = localStorage.getItem("name") || email?.split('@')[0] || "";
    const department = normalizeDepartment(localStorage.getItem("department"));
    const profilePicture = localStorage.getItem("profilePicture");
    const storedVersion = Number(localStorage.getItem("profilePictureUpdatedAt") || 0);
    setUserData(prev => ({ ...prev, email, name, department, profilePicture: profilePicture || null }));
    setProfilePictureVersion(Number.isFinite(storedVersion) ? storedVersion : 0);

    let ignore = false;
    const loadProfile = async () => {
      if (!userId) return;
      try {
        const { data } = await axios.get(`${BACKEND_URL}/users/${userId}`, {
          params: { userId, role },
        });
        if (ignore) return;
        const safeName = String(data?.name || "").trim();
        const safeEmail = String(data?.email || email || "").trim();
        const safeDepartment = normalizeDepartment(data?.department);
        const safeProfilePicture = data?.profilePicture || null;
        setUserData((prev) => ({
          ...prev,
          name: safeName,
          email: safeEmail,
          department: safeDepartment,
          profilePicture: safeProfilePicture,
        }));
        localStorage.setItem("name", safeName);
        localStorage.setItem("email", safeEmail);
        localStorage.setItem("department", safeDepartment || "Unassigned");
        const previousProfilePicture = String(localStorage.getItem("profilePicture") || "");
        if (safeProfilePicture) {
          localStorage.setItem("profilePicture", safeProfilePicture);
        } else {
          localStorage.removeItem("profilePicture");
        }

        const currentProfilePicture = String(safeProfilePicture || "");
        if (previousProfilePicture !== currentProfilePicture) {
          const updatedAt = Date.now();
          localStorage.setItem("profilePictureUpdatedAt", String(updatedAt));
          setProfilePictureVersion(updatedAt);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    };
    loadProfile();

    const savedPrefs = localStorage.getItem(`userPreferences_${userId}`);
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        console.error("Error loading preferences:", e);
      }
    }

    return () => {
      ignore = true;
    };
  }, [role, userId]);

  useEffect(() => {
    const handleProfilePictureEvent = (event) => {
      const nextProfilePicture = event?.detail?.profilePicture || null;
      const nextUpdatedAt = Number(event?.detail?.updatedAt || Date.now());
      setUserData((prev) => ({ ...prev, profilePicture: nextProfilePicture }));
      setProfilePictureVersion(Number.isFinite(nextUpdatedAt) ? nextUpdatedAt : Date.now());
    };

    const handleStorageEvent = (event) => {
      if (event.key !== "profilePicture" && event.key !== "profilePictureUpdatedAt") return;
      const nextProfilePicture = localStorage.getItem("profilePicture");
      const nextUpdatedAt = Number(localStorage.getItem("profilePictureUpdatedAt") || 0);
      setUserData((prev) => ({ ...prev, profilePicture: nextProfilePicture || null }));
      setProfilePictureVersion(Number.isFinite(nextUpdatedAt) ? nextUpdatedAt : 0);
    };

    window.addEventListener(PROFILE_PICTURE_EVENT, handleProfilePictureEvent);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener(PROFILE_PICTURE_EVENT, handleProfilePictureEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", !!preferences.darkMode);
  }, [preferences.darkMode]);

  const showMessage = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!userId) {
      showMessage("Unable to detect your account session.", "error");
      return;
    }

    const nextName = String(userData.name || "").trim();
    const nextDepartment = normalizeDepartment(userData.department);
    if (!nextName) {
      showMessage("Full name is required.", "error");
      return;
    }
    if (!nextDepartment) {
      showMessage("Department is required.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.patch(
        `${BACKEND_URL}/users/${userId}`,
        { name: nextName, department: nextDepartment, userId, role },
        { params: { userId, role } }
      );
      const updated = response.data?.user || response.data || {};
      const safeName = String(updated?.name || nextName).trim();
      const safeDepartment = normalizeDepartment(updated?.department || nextDepartment);
      const safeEmail = String(updated?.email || userData.email || "").trim();
      setUserData((prev) => ({
        ...prev,
        name: safeName,
        department: safeDepartment,
        email: safeEmail,
      }));
      localStorage.setItem("name", safeName);
      localStorage.setItem("department", safeDepartment || "Unassigned");
      if (safeEmail) localStorage.setItem("email", safeEmail);
      showMessage("Profile updated successfully!");
    } catch (error) {
      console.error("Profile update failed:", error);
      showMessage(error.response?.data?.error || "Failed to update profile.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordOtp = async () => {
    if (!userData.email) {
      showMessage("Unable to detect your email address.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/forgot-password`, {
        email: userData.email
      });

      if (response.data?.success) {
        setPasswordOtpSent(true);
        showMessage("OTP sent to your email. Enter it below to continue.");
      }
    } catch (error) {
      console.error("Send OTP failed:", error);
      showMessage(error.response?.data?.error || "Failed to send OTP.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetWithOtp = async (e) => {
    e.preventDefault();

    if (!passwordOtpSent) {
      showMessage("Please send OTP first.", "error");
      return;
    }

    if (!passwordResetCode.trim()) {
      showMessage("OTP code is required.", "error");
      return;
    }

    if (userData.newPassword !== userData.confirmPassword) {
      showMessage("New passwords do not match.", "error");
      return;
    }

    if (userData.newPassword.length < 8) {
      showMessage("Password must be at least 8 characters long.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/reset-password`, {
        email: userData.email,
        code: passwordResetCode.trim(),
        newPassword: userData.newPassword
      });

      if (response.data?.success) {
        setUserData(prev => ({
          ...prev,
          newPassword: "",
          confirmPassword: ""
        }));
        setPasswordResetCode("");
        setPasswordOtpSent(false);
        showMessage(response.data.message || "Password changed successfully.");
      }
    } catch (error) {
      console.error("Password reset failed:", error);
      showMessage(error.response?.data?.error || "Failed to reset password.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = () => {
    localStorage.setItem(`userPreferences_${userId}`, JSON.stringify(preferences));
    document.body.classList.toggle("dark-mode", !!preferences.darkMode);
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
      // Optional: center-crop to square before upload for consistent avatars
      let uploadBlob = profilePictureFile;
      try {
        const img = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = e.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(profilePictureFile);
        });
        const size = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = Math.floor((img.naturalWidth - size) / 2);
        const sy = Math.floor((img.naturalHeight - size) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
        uploadBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      } catch (cropErr) {
        console.warn("Crop failed, uploading original:", cropErr);
      }

      const formData = new FormData();
      if (uploadBlob instanceof Blob && uploadBlob !== profilePictureFile) {
        formData.append('profilePicture', uploadBlob, 'profile.jpg');
      } else {
        formData.append('profilePicture', profilePictureFile, profilePictureFile.name || 'profile.jpg');
      }
      formData.append('userId', userId);

      const response = await axios.post(`${BACKEND_URL}/upload-profile-picture`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // Update local storage with new profile picture
        const updatedAt = Date.now();
        localStorage.setItem('profilePicture', response.data.profilePicture);
        localStorage.setItem('profilePictureUpdatedAt', String(updatedAt));
        setUserData(prev => ({ ...prev, profilePicture: response.data.profilePicture }));
        setProfilePictureVersion(updatedAt);
        setProfilePictureFile(null);
        setProfilePicturePreview(null);
        dispatchProfilePictureUpdated(response.data.profilePicture, updatedAt);
        showMessage("Profile picture updated successfully!");
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
      const response = await axios.patch(
        `${BACKEND_URL}/users/${userId}`,
        { profilePicture: null, userId, role },
        { params: { userId, role } }
      );

      if (response.data) {
        const updatedAt = Date.now();
        localStorage.removeItem('profilePicture');
        localStorage.setItem('profilePictureUpdatedAt', String(updatedAt));
        setUserData(prev => ({ ...prev, profilePicture: null }));
        setProfilePictureVersion(updatedAt);
        setProfilePicturePreview(null);
        setProfilePictureFile(null);
        dispatchProfilePictureUpdated(null, updatedAt);
        showMessage("Profile picture removed successfully!");
      }
    } catch (error) {
      console.error("Profile picture removal failed:", error);
      showMessage("Failed to remove profile picture.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4 page-container">
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
                              src={buildUploadUrl(userData.profilePicture, profilePictureVersion)}
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
                        onChange={(e) => setUserData((prev) => ({ ...prev, name: e.target.value }))}
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
                    <div className="col-md-6">
                      <label htmlFor="department" className="form-label">Department</label>
                      <select
                        className="form-control"
                        id="department"
                        value={userData.department}
                        onChange={(e) => setUserData((prev) => ({ ...prev, department: e.target.value }))}
                      >
                        <option value="">Select department</option>
                        {DEPARTMENT_OPTIONS.map((dep) => (
                          <option key={dep} value={dep}>
                            {dep}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleProfileUpdate}
                      disabled={loading || !userData.name.trim() || !userData.department.trim()}
                    >
                      <FaSave className="me-2" />
                      {loading ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                  <div className="mt-2">
                    <small className="text-muted">
                      Keep your profile details updated for better assignment and reporting accuracy.
                    </small>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <form onSubmit={handlePasswordResetWithOtp}>
                  <h5 className="mb-3">Change Password via Email OTP</h5>
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label htmlFor="securityEmail" className="form-label">Registered Email</label>
                      <input
                        type="email"
                        className="form-control"
                        id="securityEmail"
                        value={userData.email}
                        readOnly
                      />
                      <small className="text-muted">
                        OTP will be sent to this email address.
                      </small>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="otpCode" className="form-label">OTP Code</label>
                      <input
                        type="text"
                        className="form-control"
                        id="otpCode"
                        value={passwordResetCode}
                        onChange={(e) => setPasswordResetCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        placeholder="Enter OTP code"
                        required
                      />
                    </div>
                    <div className="col-md-6 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-outline-primary w-100"
                        onClick={handleSendPasswordOtp}
                        disabled={loading}
                      >
                        {loading ? "Sending..." : passwordOtpSent ? "Resend OTP" : "Send OTP"}
                      </button>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="newPassword" className="form-label">New Password</label>
                      <div className="position-relative">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          className="form-control pe-5"
                          id="newPassword"
                          value={userData.newPassword}
                          onChange={(e) => setUserData(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password"
                          minLength="8"
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-link position-absolute end-0 top-50 translate-middle-y me-2 p-0 text-muted"
                          onClick={() => togglePasswordVisibility('new')}
                          style={{ zIndex: 5 }}
                        >
                          {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                      <div className="position-relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          className="form-control pe-5"
                          id="confirmPassword"
                          value={userData.confirmPassword}
                          onChange={(e) => setUserData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          minLength="8"
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-link position-absolute end-0 top-50 translate-middle-y me-2 p-0 text-muted"
                          onClick={() => togglePasswordVisibility('confirm')}
                          style={{ zIndex: 5 }}
                        >
                          {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      <FaKey className="me-2" />
                      {loading ? "Changing..." : "Change Password"}
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
                          Dark Mode
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
