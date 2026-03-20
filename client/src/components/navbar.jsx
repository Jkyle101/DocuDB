import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaSearch, FaSignOutAlt, FaBars, FaTimes, FaFolder, FaFileAlt, FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaFileArchive, FaFileVideo, FaHistory, FaTimes as FaTimesIcon, FaUser, FaUsers, FaClipboardList, FaCog, FaQuestionCircle, FaBell, FaMoon, FaSun, FaSlidersH } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "../config";
import logo from "../assets/docudbllcc.png";
import "./navbar.css";

const PROFILE_PICTURE_EVENT = "profile-picture-updated";

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function Navbar({ onSearch, toggleSidebar, isSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userEmail, setUserEmail] = useState(localStorage.getItem("email") || "");
  const [userProfilePicture, setUserProfilePicture] = useState(localStorage.getItem("profilePicture") || "");
  const [profilePictureVersion, setProfilePictureVersion] = useState(
    Number(localStorage.getItem("profilePictureUpdatedAt") || 0)
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    entityTypes: ["file", "folder"],
    fileTypes: [],
    scope: "both",
    sortBy: "relevance",
    sortOrder: "desc",
    datePreset: "any",
    dateFrom: "",
    dateTo: "",
    favoritesOnly: false,
    pinnedOnly: false,
    sharedOnly: false,
    duplicatesOnly: false,
    exactMatch: false,
    owner: "",
  });

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "faculty";
  const isAdminPage = location.pathname.startsWith('/admin');
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);
  const advancedFiltersRef = useRef(null);
  const notificationAudioRef = useRef(null);

  const buildProfilePictureUrl = useCallback((filename) => {
    const safeName = String(filename || "").trim();
    if (!safeName) return "";
    const cacheBust = Number(profilePictureVersion) > 0 ? `?v=${Number(profilePictureVersion)}` : "";
    return `${BACKEND_URL}/uploads/${safeName}${cacheBust}`;
  }, [profilePictureVersion]);

  useEffect(() => {
    const syncProfile = () => {
      setUserEmail(localStorage.getItem("email") || "");
      setUserProfilePicture(localStorage.getItem("profilePicture") || "");
      const updatedAt = Number(localStorage.getItem("profilePictureUpdatedAt") || 0);
      setProfilePictureVersion(Number.isFinite(updatedAt) ? updatedAt : 0);
    };

    const handleProfilePictureEvent = (event) => {
      const nextProfilePicture = String(event?.detail?.profilePicture || "");
      const nextUpdatedAt = Number(event?.detail?.updatedAt || Date.now());
      setUserProfilePicture(nextProfilePicture);
      setProfilePictureVersion(Number.isFinite(nextUpdatedAt) ? nextUpdatedAt : Date.now());
      setUserEmail(localStorage.getItem("email") || "");
    };

    const handleStorageEvent = (event) => {
      if (
        event.key === "email" ||
        event.key === "profilePicture" ||
        event.key === "profilePictureUpdatedAt"
      ) {
        syncProfile();
      }
    };

    syncProfile();
    window.addEventListener(PROFILE_PICTURE_EVENT, handleProfilePictureEvent);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener(PROFILE_PICTURE_EVENT, handleProfilePictureEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  useEffect(() => {
    const savedPrefs = localStorage.getItem(`userPreferences_${userId}`);
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setIsDarkMode(!!parsed.darkMode);
      } catch {
        setIsDarkMode(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    const savedPrefs = localStorage.getItem(`userPreferences_${userId}`);
    let prefs = { emailNotifications: true, darkMode: false, language: "en" };
    if (savedPrefs) {
      try {
        prefs = { ...prefs, ...JSON.parse(savedPrefs) };
      } catch {}
    }
    prefs.darkMode = isDarkMode;
    localStorage.setItem(`userPreferences_${userId}`, JSON.stringify(prefs));
  }, [isDarkMode, userId]);

  useEffect(() => {
    setAdvancedFilters((prev) => ({
      ...prev,
      entityTypes: isAdminPage ? ["file", "folder", "user", "group", "log"] : ["file", "folder"],
      owner: isAdminPage ? prev.owner : "",
    }));
  }, [isAdminPage]);

  const hasActiveAdvancedFilters = useCallback(() => {
    const defaultTypes = isAdminPage ? ["file", "folder", "user", "group", "log"] : ["file", "folder"];
    const sameEntityTypes =
      advancedFilters.entityTypes.length === defaultTypes.length &&
      advancedFilters.entityTypes.every((type) => defaultTypes.includes(type));
    return !(
      sameEntityTypes &&
      advancedFilters.fileTypes.length === 0 &&
      advancedFilters.scope === "both" &&
      advancedFilters.sortBy === "relevance" &&
      advancedFilters.sortOrder === "desc" &&
      advancedFilters.datePreset === "any" &&
      !advancedFilters.dateFrom &&
      !advancedFilters.dateTo &&
      !advancedFilters.favoritesOnly &&
      !advancedFilters.pinnedOnly &&
      !advancedFilters.sharedOnly &&
      !advancedFilters.duplicatesOnly &&
      !advancedFilters.exactMatch &&
      !advancedFilters.owner
    );
  }, [advancedFilters, isAdminPage]);

  const buildSearchParams = useCallback(
    (searchTerm, limitNum = 8) => {
      const hasTerm = !!searchTerm?.trim();
      const hasFilters = hasActiveAdvancedFilters();
      if (!hasTerm && !hasFilters) return null;

      const params = {
        userId,
        role,
        limit: limitNum,
        entityTypes: advancedFilters.entityTypes.join(","),
        scope: advancedFilters.scope,
        sortBy: advancedFilters.sortBy,
        sortOrder: advancedFilters.sortOrder,
        exactMatch: advancedFilters.exactMatch,
        favoritesOnly: advancedFilters.favoritesOnly,
        pinnedOnly: advancedFilters.pinnedOnly,
        sharedOnly: advancedFilters.sharedOnly,
        duplicatesOnly: advancedFilters.duplicatesOnly,
      };

      if (hasTerm) params.query = searchTerm.trim();
      if (advancedFilters.fileTypes.length) params.fileTypes = advancedFilters.fileTypes.join(",");
      if (advancedFilters.datePreset && advancedFilters.datePreset !== "any") {
        params.datePreset = advancedFilters.datePreset;
      }
      if (advancedFilters.dateFrom) params.dateFrom = advancedFilters.dateFrom;
      if (advancedFilters.dateTo) params.dateTo = advancedFilters.dateTo;
      if (isAdminPage && advancedFilters.owner.trim()) params.owner = advancedFilters.owner.trim();

      return params;
    },
    [advancedFilters, hasActiveAdvancedFilters, isAdminPage, role, userId]
  );

  const uniqueByKey = (arr, keyFn) => {
    const seen = new Set();
    return arr.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`recentSearches_${userId}`);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing recent searches:", e);
      }
    }
  }, [userId]);

  // Fetch notification count
  const fetchNotificationCount = async () => {
    if (!userId || isAdminPage) return;

    try {
      const response = await axios.get(`${BACKEND_URL}/notifications/${userId}`);
      const notifications = Array.isArray(response.data)
        ? response.data
        : (Array.isArray(response.data?.notifications) ? response.data.notifications : []);
      const unreadCount = notifications.filter((n) => !n?.isRead).length;

      // Play sound if new notifications arrived
      if (unreadCount > lastNotificationCount && lastNotificationCount !== 0) {
        playNotificationSound();
      }

      setUnreadNotifications(unreadCount);
      setLastNotificationCount(unreadCount);
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("Failed to play notification sound:", error);
    }
  };

  // Real-time notification polling
  useEffect(() => {
    if (!userId || isAdminPage) return;

    // Fetch immediately
    fetchNotificationCount();

    // Set up polling every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000);

    return () => clearInterval(interval);
  }, [userId, isAdminPage, lastNotificationCount]);

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((searchTerm) => {
    if (!searchTerm.trim()) return;

    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(`recentSearches_${userId}`, JSON.stringify(updated));
  }, [recentSearches, userId]);

  // File icon helper
  const getFileIcon = (mimetype) => {
    if (!mimetype) return <FaFileAlt className="text-secondary" />;
    if (mimetype.includes("pdf")) return <FaFilePdf className="text-danger" />;
    if (mimetype.includes("word") || mimetype.includes("doc")) return <FaFileWord className="text-primary" />;
    if (mimetype.includes("excel") || mimetype.includes("spreadsheet")) return <FaFileExcel className="text-success" />;
    if (mimetype.includes("image")) return <FaFileImage className="text-warning" />;
    if (mimetype.includes("zip") || mimetype.includes("rar")) return <FaFileArchive className="text-muted" />;
    if (mimetype.includes("video")) return <FaFileVideo className="text-info" />;
    return <FaFileAlt className="text-secondary" />;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchTerm) => {
      const searchParams = buildSearchParams(searchTerm, 12);
      if (!searchParams) {
        setSuggestions([]);
        setShowSuggestions(false);
        if (onSearch) onSearch(null);
        return;
      }

      try {
        setIsLoading(true);

        let res;
        if (isAdminPage) {
          res = await axios.get(`${BACKEND_URL}/admin/search`, {
            params: searchParams,
          });

          // Format admin suggestions - include files, folders, users, groups, and logs
          const formattedSuggestions = res.data.map(item => {
            let icon, type, name, path, size;

            if (item.type === 'file') {
              icon = getFileIcon(item.mimetype);
              name = item.originalName || item.name;
              type = 'File';
              path = item.path || (item.parentFolder ? 'In folder' : 'Root');
              size = item.size;
            } else if (item.type === 'folder') {
              icon = <FaFolder className="text-warning" />;
              name = item.name;
              type = 'Folder';
              path = item.path || (item.parentFolder ? 'In folder' : 'Root');
            } else if (item.type === 'user') {
              icon = <FaUser className="text-primary" />;
              name = item.name || item.email;
              type = 'User';
              path = 'User account';
            } else if (item.type === 'group') {
              icon = <FaUsers className="text-success" />;
              name = item.name;
              type = 'Group';
              path = 'Group';
            } else if (item.type === 'log') {
              icon = <FaClipboardList className="text-info" />;
              name = item.action;
              type = 'Log';
              path = 'System log';
            }

            return {
              id: item._id,
              name: name,
              type: type.toLowerCase(),
              path: path,
              icon: icon,
              size: size,
              mimetype: item.mimetype,
              ownerEmail: item.ownerEmail
            };
          });

          setSuggestions(formattedSuggestions);
        } else {
          res = await axios.get(`${BACKEND_URL}/search`, {
            params: searchParams,
          });

          // Format suggestions
          const formattedSuggestions = res.data.map(item => ({
            id: item._id,
            name: item.originalName || item.name,
            type: item.originalName ? 'file' : 'folder',
            size: item.size,
            mimetype: item.mimetype,
            path: item.parentFolder ? 'In folder' : 'Root',
            icon: item.originalName ? getFileIcon(item.mimetype) : <FaFolder className="text-warning" />
          }));
          const deduped = uniqueByKey(formattedSuggestions, s => `${s.id}-${s.type}`);

          setSuggestions(deduped);
        }

        setShowSuggestions(true);

        if (onSearch) {
          // For admin search, deduplicate by id and type (file, folder, user, group, log)
          // For regular search, use originalName to determine file vs folder
          const dedupedResults = uniqueByKey(
            Array.isArray(res.data) ? res.data : [],
            item => `${item._id}-${item.type || (item.originalName ? 'file' : 'folder')}`
          );
          onSearch(dedupedResults);
        }
      } catch (err) {
        console.error("Search failed:", err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [buildSearchParams, isAdminPage, onSearch]
  );

  // Handle input change with debounced search
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);

    if (!value.trim() && !hasActiveAdvancedFilters()) {
      setSuggestions([]);
      setShowSuggestions(false);
      if (onSearch) onSearch(null);
      return;
    }

    debouncedSearch(value);
  };

  // Handle search submission
  const handleSearch = async (searchTermOrEvent = query) => {
    if (searchTermOrEvent && typeof searchTermOrEvent.preventDefault === "function") {
      searchTermOrEvent.preventDefault();
    }
    const searchTerm = typeof searchTermOrEvent === "string" ? searchTermOrEvent : query;
    const searchParams = buildSearchParams(searchTerm, 50);
    if (!searchParams) return;

    try {
      let res;
      if (isAdminPage) {
        res = await axios.get(`${BACKEND_URL}/admin/search`, {
          params: searchParams,
        });
      } else {
        res = await axios.get(`${BACKEND_URL}/search`, {
          params: searchParams,
        });
      }
      if (onSearch) {
        // For admin search, deduplicate by id and type (file, folder, user, group, log)
        // For regular search, use originalName to determine file vs folder
        const dedupedResults = uniqueByKey(
          Array.isArray(res.data) ? res.data : [],
          item => `${item._id}-${item.type || (item.originalName ? 'file' : 'folder')}`
        );
        onSearch(dedupedResults);
      }
      if (searchTerm?.trim()) saveRecentSearch(searchTerm);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions && recentSearches.length === 0) return;

    const totalItems = (showSuggestions ? suggestions.length : 0) + recentSearches.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < recentSearches.length) {
            // Recent search
            const recentQuery = recentSearches[selectedIndex];
            setQuery(recentQuery);
            handleSearch(recentQuery);
          } else {
            // Suggestion
            const suggestionIndex = selectedIndex - recentSearches.length;
            const suggestion = suggestions[suggestionIndex];
            if (suggestion) {
              setQuery(suggestion.name);
              handleSearch(suggestion.name);
            }
          }
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        searchRef.current?.blur();
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.name);
    handleSearch(suggestion.name);
  };

  // Handle recent search click
  const handleRecentSearchClick = (recentQuery) => {
    setQuery(recentQuery);
    handleSearch(recentQuery);
  };

  // Clear search
  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    if (onSearch) onSearch(null);
  };

  const resetAdvancedFilters = () => {
    setAdvancedFilters({
      entityTypes: isAdminPage ? ["file", "folder", "user", "group", "log"] : ["file", "folder"],
      fileTypes: [],
      scope: "both",
      sortBy: "relevance",
      sortOrder: "desc",
      datePreset: "any",
      dateFrom: "",
      dateTo: "",
      favoritesOnly: false,
      pinnedOnly: false,
      sharedOnly: false,
      duplicatesOnly: false,
      exactMatch: false,
      owner: "",
    });
    if (!query.trim()) {
      setSuggestions([]);
      if (onSearch) onSearch(null);
    }
  };

  const toggleEntityType = (type) => {
    setAdvancedFilters((prev) => {
      const exists = prev.entityTypes.includes(type);
      const next = exists
        ? prev.entityTypes.filter((entry) => entry !== type)
        : [...prev.entityTypes, type];
      return { ...prev, entityTypes: next.length ? next : prev.entityTypes };
    });
  };

  const toggleFileType = (type) => {
    setAdvancedFilters((prev) => {
      const exists = prev.fileTypes.includes(type);
      const next = exists
        ? prev.fileTypes.filter((entry) => entry !== type)
        : [...prev.fileTypes, type];
      return { ...prev, fileTypes: next };
    });
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setShowAdvancedFilters(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    const email = localStorage.getItem("email");
    // Clear all persisted user data to avoid cross-user leakage (including profilePicture)
    localStorage.clear();
    // Preserve last email domain hint if needed
    if (email) {
      localStorage.setItem("lastEmail", email);
    }
    navigate("/login");
  };

  // Handle mobile search expansion
  const handleMobileSearchClick = () => {
    setIsMobileSearchExpanded(true);
    // Focus the search input after expansion
    setTimeout(() => {
      const mobileInput = document.querySelector('.mobile-search-input');
      if (mobileInput) mobileInput.focus();
    }, 100);
  };

  const handleMobileSearchBack = () => {
    setIsMobileSearchExpanded(false);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setShowAdvancedFilters(false);
  };

  const entityTypeOptions = isAdminPage
    ? [
        { key: "file", label: "Files" },
        { key: "folder", label: "Folders" },
        { key: "user", label: "Users" },
        { key: "group", label: "Groups" },
        { key: "log", label: "Logs" },
      ]
    : [
        { key: "file", label: "Files" },
        { key: "folder", label: "Folders" },
      ];

  const fileTypeOptions = ["pdf", "docx", "xlsx", "image", "video", "archive", "text"];

  const advancedFilterPanel = (
    <div ref={advancedFiltersRef} className="advanced-filters-panel">
      <div className="advanced-filters-header">
        <h6>Advanced Search</h6>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetAdvancedFilters}>
            Reset
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => handleSearch(query)}>
            Apply
          </button>
        </div>
      </div>

      <div className="advanced-filters-grid">
        <div className="advanced-filter-group">
          <label>Search Scope</label>
          <select
            className="form-select form-select-sm"
            value={advancedFilters.scope}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, scope: e.target.value }))}
          >
            <option value="both">Name + Content</option>
            <option value="name">Name only</option>
            <option value="content">Content only</option>
          </select>
        </div>

        <div className="advanced-filter-group">
          <label>Sort</label>
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={advancedFilters.sortBy}
              onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
            >
              <option value="relevance">Relevance</option>
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <select
              className="form-select form-select-sm"
              value={advancedFilters.sortOrder}
              onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, sortOrder: e.target.value }))}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>

        <div className="advanced-filter-group">
          <label>Date</label>
          <select
            className="form-select form-select-sm"
            value={advancedFilters.datePreset}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, datePreset: e.target.value }))}
          >
            <option value="any">Any time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
          {advancedFilters.datePreset === "custom" && (
            <div className="d-flex gap-2 mt-2">
              <input
                className="form-control form-control-sm"
                type="date"
                value={advancedFilters.dateFrom}
                onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
              />
              <input
                className="form-control form-control-sm"
                type="date"
                value={advancedFilters.dateTo}
                onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          )}
        </div>

        {isAdminPage && (
          <div className="advanced-filter-group">
            <label>Owner (Admin)</label>
            <input
              className="form-control form-control-sm"
              value={advancedFilters.owner}
              placeholder="email or name"
              onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, owner: e.target.value }))}
            />
          </div>
        )}
      </div>

      <div className="advanced-filter-group">
        <label>Entity Types</label>
        <div className="advanced-filter-chips">
          {entityTypeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`chip-btn ${advancedFilters.entityTypes.includes(option.key) ? "active" : ""}`}
              onClick={() => toggleEntityType(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="advanced-filter-group">
        <label>File Types</label>
        <div className="advanced-filter-chips">
          {fileTypeOptions.map((typeName) => (
            <button
              key={typeName}
              type="button"
              className={`chip-btn ${advancedFilters.fileTypes.includes(typeName) ? "active" : ""}`}
              onClick={() => toggleFileType(typeName)}
            >
              {typeName.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="advanced-filter-flags">
        <label className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={advancedFilters.favoritesOnly}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, favoritesOnly: e.target.checked }))}
          />
          <span className="form-check-label">Favorites only</span>
        </label>
        <label className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={advancedFilters.pinnedOnly}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, pinnedOnly: e.target.checked }))}
          />
          <span className="form-check-label">Pinned only</span>
        </label>
        <label className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={advancedFilters.sharedOnly}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, sharedOnly: e.target.checked }))}
          />
          <span className="form-check-label">Shared only</span>
        </label>
        <label className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={advancedFilters.duplicatesOnly}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, duplicatesOnly: e.target.checked }))}
          />
          <span className="form-check-label">Duplicates only</span>
        </label>
        <label className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={advancedFilters.exactMatch}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, exactMatch: e.target.checked }))}
          />
          <span className="form-check-label">Exact match</span>
        </label>
      </div>
    </div>
  );

  return (
    <>

      {/* Mobile Search Expanded View */}
      {isMobileSearchExpanded && (
        <div className="mobile-search-expanded">
          <div className="mobile-search-header">
            <button
              className="mobile-search-back"
              onClick={handleMobileSearchBack}
              aria-label="Close search"
            >
              <FaTimes size={20} />
            </button>

            <div className="mobile-search-input-container">
              <form onSubmit={handleSearch}>
                <FaSearch className="mobile-search-icon" />
                <input
                  className="mobile-search-input"
                  type="search"
                  placeholder="Search in Drive"
                  value={query}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    className="mobile-search-clear"
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    <FaTimesIcon size={16} />
                  </button>
                )}
              </form>
            </div>

            <div className="mobile-search-actions">
              <button
                className={`navbar-icon-google ${hasActiveAdvancedFilters() ? "active-advanced" : ""}`}
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                title="Advanced search filters"
              >
                <FaSlidersH size={18} />
              </button>

              <Link to="/notifications" className="navbar-icon-google position-relative" title="Notifications">
                <FaBell size={20} />
                {unreadNotifications > 0 && (
                  <span className="notification-badge-google">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>

              <button
                className="navbar-icon-google"
                type="button"
                onClick={() => setIsDarkMode((v) => !v)}
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? <FaSun size={18} /> : <FaMoon size={18} />}
              </button>

              <div className="dropdown">
                <button
                  className="user-avatar-google"
                  type="button"
                  id="mobileUserDropdown"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  title={userEmail}
                >
                  {userProfilePicture ? (
                    <img
                      src={buildProfilePictureUrl(userProfilePicture)}
                      alt="Profile"
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                    />
                  ) : (
                    <FaUser size={16} />
                  )}
                </button>

                <ul className="dropdown-menu dropdown-menu-google" aria-labelledby="mobileUserDropdown">
                  <li>
                    <div className="dropdown-header-google">
                      <div className="user-info-google">
                        <div className="user-avatar-dropdown-google">
                          {userProfilePicture ? (
                            <img
                              src={buildProfilePictureUrl(userProfilePicture)}
                              alt="Profile"
                              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                            />
                          ) : (
                            <FaUser size={16} />
                          )}
                        </div>
                        <div className="user-details-google">
                          <div className="user-email-google">{userEmail}</div>
                          <div className="user-role-google">{role}</div>
                        </div>
                      </div>
                    </div>
                  </li>

                  <li><hr className="dropdown-divider-google" /></li>

                  <li>
                    <button
                      className="dropdown-item dropdown-item-google"
                      onClick={() => {
                        document.querySelector('#mobileUserDropdown').click();
                        handleMobileSearchClick();
                      }}
                    >
                      <FaSearch />
                      <span>Search</span>
                    </button>
                  </li>

                  <li>
                    <Link to="/settings" className="dropdown-item dropdown-item-google"
                          onClick={() => {
                            document.querySelector('#mobileUserDropdown').click();
                            handleMobileSearchBack();
                          }}>
                      <FaCog />
                      <span>Settings</span>
                    </Link>
                  </li>

                <li>
                  <Link to="/help" className="dropdown-item dropdown-item-google"
                        onClick={() => {
                          document.querySelector('#mobileUserDropdown')?.click();
                          setIsMobileSearchExpanded(false);
                        }}>
                    <FaQuestionCircle />
                    <span>Help & feedback</span>
                  </Link>
                </li>

                  <li><hr className="dropdown-divider-google" /></li>

                  <li>
                    <button
                      className="dropdown-item dropdown-item-google dropdown-item-danger-google"
                      type="button"
                      onClick={() => {
                        handleMobileSearchBack();
                        handleLogout();
                      }}
                    >
                      <FaSignOutAlt />
                      <span>Sign out</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mobile-search-body">
            {showAdvancedFilters && (
              <div className="mobile-advanced-filters-wrap">{advancedFilterPanel}</div>
            )}

            {/* Mobile Search Suggestions */}
            {((query === "" && isInputFocused && recentSearches.length > 0) || showSuggestions) && (
              <div className="mobile-suggestions-google">
                {/* Recent Searches */}
                {query === "" && recentSearches.length > 0 && (
                  <div className="suggestion-section-google">
                    <div className="suggestion-header-google">
                      <FaHistory className="me-1" size={10} />
                      Recent searches
                    </div>
                    {recentSearches.map((recent, index) => (
                      <div
                        key={`mobile-recent-${index}`}
                        className={`suggestion-item-google ${selectedIndex === index ? 'selected-google' : ''}`}
                        onClick={() => {
                          handleRecentSearchClick(recent);
                          handleMobileSearchBack();
                        }}
                      >
                        <FaSearch className="suggestion-icon-google" size={16} />
                        <div className="suggestion-content-google">
                          <div className="suggestion-title-google">{recent}</div>
                        </div>
                      </div>
                    ))}
                    {suggestions.length > 0 && <hr className="my-1" />}
                  </div>
                )}

                {/* Search Suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestion-section-google">
                    {query === "" && recentSearches.length === 0 && (
                      <div className="suggestion-header-google">
                        <FaSearch className="me-1" size={10} />
                        Search results
                      </div>
                    )}
                    {suggestions.map((suggestion, index) => {
                      const actualIndex = query === "" ? recentSearches.length + index : index;
                      return (
                        <div
                          key={`mobile-suggestion-${suggestion.id}`}
                          className={`suggestion-item-google ${selectedIndex === actualIndex ? 'selected-google' : ''}`}
                          onClick={() => {
                            handleSuggestionClick(suggestion);
                            handleMobileSearchBack();
                          }}
                        >
                          <div className="suggestion-icon-google">
                            {suggestion.icon}
                          </div>
                          <div className="suggestion-content-google">
                            <div className="suggestion-title-google">{suggestion.name}</div>
                            <div className="suggestion-meta-google">
                              {suggestion.type} | {suggestion.path}
                              {suggestion.size && ` | ${formatFileSize(suggestion.size)}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* No Results */}
                {query && !isLoading && showSuggestions && suggestions.length === 0 && (
                  <div className="no-results-google">
                    <FaSearch />
                    <div>No results found for "{query}"</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaCog className="me-2" />
                  Settings & Account
                </h5>
                <button type="button" className="btn-close" onClick={() => setIsSettingsModalOpen(false)}></button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-4">
                  <div className="user-avatar-modal mb-3">
                    {userProfilePicture ? (
                      <img
                        src={buildProfilePictureUrl(userProfilePicture)}
                        alt="Profile"
                        className="user-avatar-img-modal"
                      />
                    ) : (
                      <FaUser size={40} />
                    )}
                  </div>
                  <h6>{userEmail}</h6>
                  <small className="text-muted">{role}</small>
                </div>

                <div className="d-grid gap-2">
                  <Link
                    to="/settings"
                    className="btn btn-outline-primary d-flex align-items-center justify-content-start"
                    onClick={() => setIsSettingsModalOpen(false)}
                  >
                    <FaCog className="me-2" />
                    Settings
                  </Link>

                  <Link
                    to="/help"
                    className="btn btn-outline-info d-flex align-items-center justify-content-start"
                    onClick={() => setIsSettingsModalOpen(false)}
                  >
                    <FaQuestionCircle className="me-2" />
                    Help & Feedback
                  </Link>

                  {!isAdminPage && (
                    <Link
                      to="/notifications"
                      className="btn btn-outline-warning d-flex align-items-center justify-content-start position-relative"
                      onClick={() => setIsSettingsModalOpen(false)}
                    >
                      <FaBell className="me-2" />
                      Notifications
                      {unreadNotifications > 0 && (
                        <span className="notification-badge-modal">
                          {unreadNotifications > 99 ? '99+' : unreadNotifications}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-danger"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    handleLogout();
                  }}
                >
                  <FaSignOutAlt className="me-2" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Style Navigation Bar */}
      <nav className="navbar-google-drive">
        <div className="d-flex align-items-center w-100 px-4">
          {/* Left Section: Brand */}
          <div className="d-flex align-items-center">
            <button
              className="navbar-icon-google d-lg-none"
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
            </button>

            <Link className="navbar-brand-google" to={isAdminPage ? "/admin" : "/"}>
              <img
                src={logo}
                alt="DocuDB"
              />
              <span>DocuDB</span>
            </Link>
          </div>

          {/* Center Section: Desktop Search Bar */}
          <div className="search-container-google" ref={searchRef}>
            <div className="search-toolbar-google">
            <div className="search-wrapper-google">
              <form onSubmit={handleSearch}>
                <FaSearch className="search-icon-google" />

                <input
                  className="search-input-google"
                  type="search"
                  placeholder={isAdminPage ? "Search in Drive" : "Search in Drive"}
                  value={query}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    setIsInputFocused(true);
                    if (recentSearches.length > 0 && query === "") {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsInputFocused(false), 150);
                  }}
                  autoComplete="off"
                />

                {query && (
                  <button
                    type="button"
                    className="search-clear-google"
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    <FaTimesIcon size={16} />
                  </button>
                )}

                {isLoading && !query && (
                  <div className="position-absolute top-50 end-0 translate-middle-y me-3">
                    <div className="spinner-border spinner-border-sm text-muted" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
              </form>

              {/* Google Drive Style Suggestions Dropdown */}
              {((query === "" && isInputFocused && recentSearches.length > 0) || showSuggestions) && (
                <div
                  ref={suggestionsRef}
                  className="suggestions-google"
                >
                  {/* Recent Searches */}
                  {query === "" && recentSearches.length > 0 && (
                    <div className="suggestion-section-google">
                      <div className="suggestion-header-google">
                        <FaHistory className="me-1" size={10} />
                        Recent searches
                      </div>
                      {recentSearches.map((recent, index) => (
                        <div
                          key={`recent-${index}`}
                          className={`suggestion-item-google ${selectedIndex === index ? 'selected-google' : ''}`}
                          onClick={() => handleRecentSearchClick(recent)}
                        >
                          <FaSearch className="suggestion-icon-google" size={16} />
                          <div className="suggestion-content-google">
                            <div className="suggestion-title-google">{recent}</div>
                          </div>
                        </div>
                      ))}
                      {suggestions.length > 0 && <hr className="my-1" />}
                    </div>
                  )}

                  {/* Search Suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="suggestion-section-google">
                      {query === "" && recentSearches.length === 0 && (
                        <div className="suggestion-header-google">
                          <FaSearch className="me-1" size={10} />
                          Search results
                        </div>
                      )}
                      {suggestions.map((suggestion, index) => {
                        const actualIndex = query === "" ? recentSearches.length + index : index;
                        return (
                          <div
                            key={suggestion.id}
                            className={`suggestion-item-google ${selectedIndex === actualIndex ? 'selected-google' : ''}`}
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            <div className="suggestion-icon-google">
                              {suggestion.icon}
                            </div>
                            <div className="suggestion-content-google">
                              <div className="suggestion-title-google">{suggestion.name}</div>
                              <div className="suggestion-meta-google">
                                {suggestion.type} | {suggestion.path}
                                {suggestion.size && ` | ${formatFileSize(suggestion.size)}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No Results */}
                  {query && !isLoading && showSuggestions && suggestions.length === 0 && (
                    <div className="no-results-google">
                      <FaSearch />
                      <div>No results found for "{query}"</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className={`search-advanced-toggle ${hasActiveAdvancedFilters() ? "active" : ""}`}
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              title="Advanced search filters"
            >
              <FaSlidersH size={14} />
            </button>
            </div>
            {showAdvancedFilters && advancedFilterPanel}
          </div>

          {/* Mobile Search Button */}
          <button
            className="mobile-search-button"
            onClick={handleMobileSearchClick}
            aria-label="Open search"
          >
            <FaSearch size={20} />
          </button>

          {/* Right Section: Desktop Icons Only */}
          <div className="navbar-right-google">
            {/* Notifications Bell - Only for users */}
            {!isAdminPage && (
              <Link to="/notifications" className="navbar-icon-google position-relative" title="Notifications">
                <FaBell size={20} />
                {unreadNotifications > 0 && (
                  <span className="notification-badge-google">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>
            )}

            <button
              className="navbar-icon-google"
              type="button"
              onClick={() => setIsDarkMode((v) => !v)}
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <FaSun size={20} /> : <FaMoon size={20} />}
            </button>

            {/* Settings Button */}
            <button
              className="navbar-icon-google"
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              title="Settings"
            >
              <FaCog size={20} />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

export default Navbar;

