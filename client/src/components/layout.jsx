// src/components/Layout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import SidebarUser from "./sidebaruser";
import SidebarAdmin from "./sidebaradmin";
import NavBar from "./navbar";

function Layout({ role }) {
  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-grow-1">
      <NavBar />
        {/* Sidebar changes depending on role */}
        {role === "admin" ? <SidebarAdmin /> : <SidebarUser />}
        
        {/* Page Content */}
        <div className="col p-4">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Layout;
