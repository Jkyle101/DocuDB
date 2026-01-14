import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { FaUserFriends, FaUsers, FaBell, FaBullhorn, FaShare, FaTimes, FaEye, FaEyeSlash } from "react-icons/fa";
import GroupShareModal from "../components/GroupShareModal";

export default function MyGroups() {
  const userId = localStorage.getItem("userId");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const fetchGroups = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/users/${userId}/groups`);
      setGroups(res.data);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchGroupDetails = async (groupId) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/groups/${groupId}`);
      // Update the selected group with fresh data
      setSelectedGroup(res.data);
      // Also update in the groups array
      setGroups(prev => prev.map(g => g._id === groupId ? res.data : g));
    } catch (err) {
      console.error("Failed to fetch group details:", err);
    }
  };

  const handleUnshareFromGroup = async (type, itemId) => {
    if (!window.confirm(`Remove this ${type} from the group?`)) return;

    try {
      await axios.patch(`${BACKEND_URL}/groups/${selectedGroup._id}/unshare`, {
        type,
        itemId,
        userId
      });

      // Refresh the group data
      await fetchGroupDetails(selectedGroup._id);
    } catch (err) {
      console.error("Failed to unshare:", err);
      alert("Failed to remove item from group");
    }
  };

  const handleShared = async () => {
    // Refresh the selected group data
    if (selectedGroup) {
      await fetchGroupDetails(selectedGroup._id);
    }
    setShowShareModal(false);
  };

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold text-primary mb-0">
          <FaUserFriends className="me-2" /> My Groups
        </h4>
      </div>

      {loading ? (
        <p>Loading groups...</p>
      ) : groups.length === 0 ? (
        <div className="alert alert-info">
          <p className="mb-0">You are not a member of any groups yet.</p>
        </div>
      ) : (
        <div className="row g-4">
          {groups.map((group) => (
            <div key={group._id} className="col-md-6 col-lg-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <h5 className="card-title text-primary">{group.name}</h5>
                  <p className="card-text text-muted">
                    {group.description || "No description"}
                  </p>
                  <div className="mb-3">
                    <small className="text-muted">
                      <FaUsers className="me-1" /> {group.members?.length || 0} Members
                    </small>
                  </div>
                  {group.notifications && group.notifications.length > 0 && (
                    <div className="mb-2">
                      <small className="text-muted">
                        <FaBell className="me-1" /> {group.notifications.length} Notification(s)
                      </small>
                    </div>
                  )}
                  {group.announcements && group.announcements.length > 0 && (
                    <div className="mb-2">
                      <small className="text-muted">
                        <FaBullhorn className="me-1" /> {group.announcements.length} Announcement(s)
                      </small>
                    </div>
                  )}
                  <button
                    className="btn btn-sm btn-outline-primary w-100"
                    onClick={() => fetchGroupDetails(group._id)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group Details Modal */}
      {selectedGroup && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedGroup.name}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedGroup(null)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Tabs */}
                <ul className="nav nav-tabs mb-3">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === "details" ? "active" : ""}`}
                      onClick={() => setActiveTab("details")}
                    >
                      Details
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === "shared" ? "active" : ""}`}
                      onClick={() => setActiveTab("shared")}
                    >
                      Shared Files
                    </button>
                  </li>
                </ul>

                {/* Tab Content */}
                {activeTab === "details" && (
                  <>
                    <p className="mb-3">{selectedGroup.description || "No description"}</p>

                    <h6 className="mb-2">
                      <FaUsers className="me-2" /> Members ({selectedGroup.members?.length || 0})
                    </h6>
                    <div className="list-group mb-4">
                      {selectedGroup.members?.map((member) => (
                        <div key={member._id} className="list-group-item">
                          {member.email}
                        </div>
                      ))}
                    </div>

                    {selectedGroup.notifications && selectedGroup.notifications.length > 0 && (
                      <>
                        <h6 className="mb-2">
                          <FaBell className="me-2" /> Notifications
                        </h6>
                        <div className="list-group mb-4">
                          {selectedGroup.notifications.map((notif, idx) => (
                            <div key={idx} className="list-group-item">
                              <strong>{notif.title}</strong>
                              <p className="mb-0">{notif.message}</p>
                              <small className="text-muted">
                                {new Date(notif.createdAt).toLocaleString()}
                              </small>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {selectedGroup.announcements && selectedGroup.announcements.length > 0 && (
                      <>
                        <h6 className="mb-2">
                          <FaBullhorn className="me-2" /> Announcements
                        </h6>
                        <div className="list-group">
                          {selectedGroup.announcements.map((ann, idx) => (
                            <div key={idx} className="list-group-item">
                              <strong>{ann.title}</strong>
                              <p className="mb-0">{ann.content}</p>
                              <small className="text-muted">
                                {new Date(ann.createdAt).toLocaleString()}
                              </small>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {activeTab === "shared" && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0">
                        <FaShare className="me-2" /> Shared Files & Folders
                      </h6>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setShowShareModal(true)}
                      >
                        <FaShare className="me-1" /> Share New
                      </button>
                    </div>

                    {/* Shared Files */}
                    {selectedGroup.sharedFiles && selectedGroup.sharedFiles.length > 0 && (
                      <>
                        <h6 className="mb-2">Files</h6>
                        <div className="list-group mb-3">
                          {selectedGroup.sharedFiles.map((sharedFile) => (
                            <div key={sharedFile._id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div className="flex-grow-1">
                                <strong>{sharedFile.fileId.originalName || sharedFile.fileId.filename}</strong>
                                <br />
                                <small className="text-muted">
                                  Type: {sharedFile.fileId.mimetype} •
                                  Size: {(sharedFile.fileId.size / 1024).toFixed(1)} KB •
                                  Uploaded: {new Date(sharedFile.fileId.uploadDate).toLocaleDateString()} •
                                  Permission: {sharedFile.permission === "read" ? "Read Only" : "Read & Write"} •
                                  Shared by: {sharedFile.sharedBy.email} •
                                  {new Date(sharedFile.sharedAt).toLocaleDateString()}
                                </small>
                              </div>
                              {(selectedGroup.createdBy._id === userId || selectedGroup.leaders?.some(l => l?._id === userId) || sharedFile.fileId.owner === userId) && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleUnshareFromGroup("file", sharedFile.fileId._id)}
                                title="Remove from group"
                              >
                                <FaTimes />
                              </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Shared Folders */}
                    {selectedGroup.sharedFolders && selectedGroup.sharedFolders.length > 0 && (
                      <>
                        <h6 className="mb-2">Folders</h6>
                        <div className="list-group">
                          {selectedGroup.sharedFolders.map((sharedFolder) => (
                            <div key={sharedFolder._id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div className="flex-grow-1">
                                <strong>{sharedFolder.folderId.name}</strong>
                                <br />
                                <small className="text-muted">
                                  Created: {new Date(sharedFolder.folderId.createdAt).toLocaleDateString()} •
                                  Permission: {sharedFolder.permission === "read" ? "Read Only" : "Read & Write"} •
                                  Shared by: {sharedFolder.sharedBy.email} •
                                  {new Date(sharedFolder.sharedAt).toLocaleDateString()}
                                </small>
                              </div>
                              {(selectedGroup.createdBy._id === userId || selectedGroup.leaders?.some(l => l?._id === userId) || sharedFolder.folderId.owner === userId) && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleUnshareFromGroup("folder", sharedFolder.folderId._id)}
                                title="Remove from group"
                              >
                                <FaTimes />
                              </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* No shared items */}
                    {(!selectedGroup.sharedFiles || selectedGroup.sharedFiles.length === 0) &&
                     (!selectedGroup.sharedFolders || selectedGroup.sharedFolders.length === 0) && (
                      <div className="text-center py-4">
                        <FaShare className="text-muted mb-2" size={48} />
                        <p className="text-muted">No files or folders are shared with this group yet.</p>
                        <button
                          className="btn btn-primary"
                          onClick={() => setShowShareModal(true)}
                        >
                          <FaShare className="me-1" /> Share Your First Item
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedGroup(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Share Modal */}
      {showShareModal && selectedGroup && (
        <GroupShareModal
          group={selectedGroup}
          onClose={() => setShowShareModal(false)}
          onShared={handleShared}
        />
      )}
    </div>
  );
}
