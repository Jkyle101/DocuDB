import React, { useState, useEffect } from "react";
import { FaSearch, FaSignOutAlt, FaBars, FaTimes, FaFolder, FaFileAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import logo from "../assets/docudbllcc.png"
const API = "http://localhost:3001";

function Navbar({ onSearch, toggleSidebar, isSidebarOpen }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  const userId = localStorage.getItem("userId");

  useEffect(() => { 
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      setShowDropdown(false);
      if (onSearch) onSearch(null);
      return;
    }

    try {
      const res = await axios.get(`${API}/search`, {
        params: { query: value, userId },
      });
      setResults(res.data);
      setShowDropdown(true);
      if (onSearch) onSearch(res.data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      const res = await axios.get(`${API}/search`, {
        params: { query, userId },
      });
      setResults(res.data);
      setShowDropdown(true);
      if (onSearch) onSearch(res.data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleResultClick = (item) => {
    if (item.type === "folder") {
      navigate(`/folder/${item._id}`);
    } else {
      if (item.url) {
        window.open(item.url, "_blank");
      }
    }
    setShowDropdown(false);
    setQuery("");
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    navigate("/login");
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow">
        <div className="container-fluid">
          <button
            className="navbar-toggler me-2"
            type="button"
            onClick={toggleSidebar}
          >
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          
          <a className="navbar-brand d-flex align-items-center" href="/">
            <img
              src={logo}
              alt="DocuDB"
              style={{ height: "40px" }}
              className="me-2"
            />
            <span className="d-none d-md-inline">DocuDB</span>
          </a>

          <div className="navbar-collapse">
            <form
              className="d-flex my-2 my-lg-0 mx-lg-auto w-100 w-lg-50 position-relative"
              onSubmit={handleSearch}
            >
              <div className="input-group">
                <input
                  className="form-control"
                  type="search"
                  placeholder="Search in Drive"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => query && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                />
                <button className="btn btn-light" type="submit">
                  <FaSearch />
                </button>
              </div>

            </form>

            <div className="d-flex align-items-center ms-lg-3 mt-2 mt-lg-0">
              <button
                className="btn btn-outline-light d-flex align-items-center"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="me-1" /> 
                <span className="ms-1 d-none d-md-inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile overlay when menu is open */}
      {isSidebarOpen && isMobile && (
        <div 
          className="mobile-overlay"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
}

export default Navbar;