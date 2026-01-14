import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";


export default function ShareModal({ onClose, target }) {
  const [emails, setEmails] = useState(""); // comma separated emails
  const [permission, setPermission] = useState("read");
  const [allUsers, setAllUsers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Fetch all users when modal opens
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/users`);
        setAllUsers(res.data);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();
  }, []);

  // Get the current input value (last email being typed)
  const getCurrentInput = () => {
    const parts = emails.split(",");
    return parts[parts.length - 1]?.trim() || "";
  };

  const currentInput = getCurrentInput();

  // Filter suggestions based on current input - only show when typing
  useEffect(() => {
    const addedEmails = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const lastPart = currentInput.toLowerCase();

    if (lastPart) {
      const filtered = allUsers.filter(
        (user) =>
          user.email.toLowerCase().includes(lastPart) &&
          !addedEmails.includes(user.email)
      );
      setSuggestions(filtered.slice(0, 5)); // Show max 5 suggestions
      setShowSuggestions(filtered.length > 0);
    } else {
      // Don't show suggestions when input is empty
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [emails, allUsers, currentInput]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (userEmail) => {
    const parts = emails.split(",").map((e) => e.trim()).filter(Boolean);
    if (!parts.includes(userEmail)) {
      parts.push(userEmail);
      setEmails(parts.join(", "));
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const submit = async () => {
    // backend will resolve emails → userIds
    const body = {
      emails: emails
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      permission,
    };
    if (target.type === "file") {
      await axios.patch(`${BACKEND_URL}/files/${target.item._id}/share`, body);
    } else {
      await axios.patch(`${BACKEND_URL}/folders/${target.item._id}/share`, body);
    }
    onClose();
  };

  return (
    <div className="modal d-block " tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content ">
          <div className="modal-header">
            <h5 className="modal-title">Share {target.type}</h5>
          </div>
          <div className="modal-body">
            <label className="form-label">User emails (comma separated)</label>
            <div className="position-relative">
              <input
                ref={inputRef}
                className="form-control mb-3"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                placeholder="Type email to search users... (comma separated)"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="list-group position-absolute w-100"
                  style={{ zIndex: 1000, maxHeight: "200px", overflowY: "auto", top: "100%" }}
                >
                  {suggestions.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      className="list-group-item list-group-item-action"
                      onClick={() => handleSuggestionClick(user.email)}
                    >
                      {user.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="form-label">Permission</label>
            <select
              className="form-select"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit}>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
