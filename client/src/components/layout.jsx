// src/components/Layout.jsx
import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import SidebarUser from "./sidebaruser";
import SidebarAdmin from "./sidebaradmin";
import NavBar from "./navbar";
import "./layout.css";

function Layout({ role }) {
  const [searchResults, setSearchResults] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      // Close sidebar on mobile when resizing to desktop
      if (!mobile) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar when clicking outside on mobile
  const handleOverlayClick = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="layout d-flex flex-column vh-100">
      {/* Navbar at the top */}
      <NavBar 
        onSearch={setSearchResults} 
        toggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Main content area (sidebar + page content) */}
      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Mobile overlay */}
        {isSidebarOpen && isMobile && (
          <div 
            className="mobile-overlay"
            onClick={handleOverlayClick}
          ></div>
        )}

        {/* Sidebar (switches by role) */}
        <div className={`sidebar-wrapper ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          {role === "admin" ? <SidebarAdmin onClose={handleOverlayClick} /> : <SidebarUser onClose={handleOverlayClick} />}
        </div>

        {/* Page Content */}
        <main className="content-area flex-grow-1 p-4 overflow-auto">
          <Outlet context={{ searchResults }} />
        </main>
      </div>
    </div>
  );
}

export default Layout;
