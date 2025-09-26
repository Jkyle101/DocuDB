// src/components/Layout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarUser from "./sidebaruser";
import SidebarAdmin from "./sidebaradmin";
import NavBar from "./navbar";
import "./layout.css";

function Layout({ role }) {
  const [searchResults, setSearchResults] = useState(null);

  return (
    <div className="layout d-flex flex-column vh-100">
      {/* Navbar at the top */}
      <NavBar onSearch={setSearchResults} />

      {/* Main content area (sidebar + page content) */}
      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Sidebar (switches by role) */}
        <div className="sidebar-wrapper">
          {role === "admin" ? <SidebarAdmin /> : <SidebarUser />}
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
