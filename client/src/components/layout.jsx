import React, { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarUser from "./sidebaruser";
import SidebarAdmin from "./sidebaradmin";
import NavBar from "./navbar";
import "./layout.css";

function normalizeRole(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "admin") return "superadmin";
  if (raw === "faculty") return "user";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  if (raw === "reviewer") return "evaluator";
  return raw;
}

function Layout({ role }) {
  const [searchResults, setSearchResults] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  const activeRole = useMemo(
    () => normalizeRole(localStorage.getItem("role") || role),
    [role]
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const handleOverlayClick = () => {
    if (isMobile) setIsSidebarOpen(false);
  };

  return (
    <div className="layout d-flex flex-column vh-100">
      <NavBar onSearch={setSearchResults} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <div className="d-flex flex-grow-1 overflow-hidden">
        {isSidebarOpen && isMobile && <div className="mobile-overlay" onClick={handleOverlayClick} />}
        <div className={`sidebar-wrapper ${isSidebarOpen ? "sidebar-open" : ""}`}>
          {activeRole === "superadmin" ? (
            <SidebarAdmin onClose={handleOverlayClick} />
          ) : (
            <SidebarUser onClose={handleOverlayClick} />
          )}
        </div>
        <main className="content-area flex-grow-1 overflow-auto">
          <Outlet context={{ searchResults }} />
        </main>
      </div>
    </div>
  );
}

export default Layout;
