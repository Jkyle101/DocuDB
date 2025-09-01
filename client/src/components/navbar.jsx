import React, { useState } from "react";
import { FaSearch, FaSignOutAlt, FaFileAlt, FaFolder } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import logo from "../assets/docudbllcc.png";
const API = "http://localhost:3001";
function Navbar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const userId = localStorage.getItem("userId");

  //  Handle input change with live search
  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      const res = await axios.get("http://localhost:3001/search", {
        params: { query: value, userId },
      });
      setResults(res.data);
      setShowDropdown(true);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  // 🔍 Handle manual form submit
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      const res = await axios.get("http://localhost:3001/search", {
        params: { query, userId },
      });
      setResults(res.data);
      setShowDropdown(true);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  // 📂 Handle click on search result
  const handleResultClick = (item) => {
    if (item.type === "folder") {
      navigate(`/folder/${item._id}`);
    } else {
      // Files: open/download link
      if (item.url) {
        window.open(item.url, "_blank");
      }
    }
    setShowDropdown(false);
    setQuery("");
  };

  return (
    <div className="navbar-container position-relative">
      <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
        <a className="navbar-brand d-flex align-items-center" href="/">
          <img
            src={logo}
            alt="DocuDB"
            style={{ height: "50px", marginLeft: "100px" }}
            className="me-2"
          />
        </a>

        <div className="collapse navbar-collapse" id="navbarContent">
          {/* Search bar */}
          <form
            className="d-flex mx-auto w-75 w-lg-50 position-relative"
            onSubmit={handleSearch}
          >
            <input
              className="form-control form-control-sm me-2"
              type="search"
              placeholder="Search in Drive"
              value={query}
              onChange={handleInputChange}
              onFocus={() => query && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            <button className="btn btn-sm btn-outline-primary" type="submit">
              <FaSearch />
            </button>

            {/* Dropdown results */}
            {showDropdown && results.length > 0 && (
              <ul
                className="list-group position-absolute mt-5 shadow-sm"
                style={{
                  width: "100%",
                  zIndex: 1000,
                  maxHeight: "250px",
                  overflowY: "auto",
                }}
              >
                {results.map((item) => (
                  <li
                    key={item._id}
                    className="list-group-item list-group-item-action d-flex align-items-center"
                    onClick={() => handleResultClick(item)}
                    style={{ cursor: "pointer" }}
                  >
                    
                    {item.type === "folder" ? (
                      <>
                        <FaFolder size={20} className="text-warning me-2" />
                        <span>{item.name}</span>
                      </>
                    ) : (
                      <>
                        <FaFileAlt size={20} className="text-primary me-2" />
                        {/* Show originalName instead of filename */}
                        <span>{item.originalName}</span>
                        
                      </>
                    )}
                    <a
                        className="btn btn-sm btn-outline-success"
                        href={`${API}/download/${item.originalName}`}
                      >
                        Download
                      </a>
                    
                  </li>
                ))}
                
              </ul>
            )}
          </form>

          {/* 🚪 Logout */}
          <div className="d-flex align-items-center ms-lg-3">
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center"
              onClick={() => {
                localStorage.removeItem("isLoggedIn");
                navigate("/login");
              }}
            >
              <FaSignOutAlt className="me-1" /> Logout
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default Navbar;
