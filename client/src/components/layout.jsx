// src/components/Layout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarUser from "./sidebaruser";
import SidebarAdmin from "./sidebaradmin";
import NavBar from "./navbar";

function Layout({ role }) {
  const [searchResults, setSearchResults] = useState(null);

  return (
    <div className="container-fluid vh-50 d-flex flex-column">
      <div className="row flex-grow-1">
        {/* Navbar now passes results up */}
        <NavBar onSearch={setSearchResults} />

        {/* Sidebar changes depending on role */}
        {role === "admin" ? <SidebarAdmin /> : <SidebarUser />}

        {/* Page Content gets both search results and default content */}
        <div className="col p-4">
          <Outlet context={{ searchResults }} />
        </div>
      </div>
    </div>
  );
}

export default Layout;
  