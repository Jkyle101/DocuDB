import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FaArchive, FaBook, FaCodeBranch, FaLayerGroup, FaListUl } from "react-icons/fa";
import AdminTasksPage from "./admintasks";
import CopcWorkflowPage from "./copcworkflow";
import AdminCopcProgramsPage from "./admincopcprograms";
import "./admincopcdashboard.css";

const TAB_CONFIG = {
  workflow: {
    label: "COPC Workflow",
    icon: FaLayerGroup,
  },
  tasks: {
    label: "Task Management",
    icon: FaListUl,
  },
  programs: {
    label: "Program Management",
    icon: FaArchive,
  },
};

export default function AdminCopcDashboardPage({ defaultTab = "workflow" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const fallbackTab = TAB_CONFIG[defaultTab] ? defaultTab : "workflow";
  const rawTab = String(searchParams.get("tab") || fallbackTab);
  const activeTab = TAB_CONFIG[rawTab] ? rawTab : fallbackTab;

  const openTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tabKey);
    navigate(`/admin/copc-dashboard?${nextParams.toString()}`);
  };

  const isCanonicalRoute = location.pathname === "/admin/copc-dashboard";
  const title = isCanonicalRoute ? "COPC Admin Dashboard" : "COPC Dashboard";
  const activeTabLabel = TAB_CONFIG[activeTab]?.label || "COPC Workflow";

  return (
    <div className="container-fluid py-3 copc-dashboard-gh">
      <div className="copc-gh-shell">
        <div className="copc-gh-repo-header">
          <div className="copc-gh-repo-main">
            <div className="copc-gh-repo-path">
              <FaBook className="me-2" />
              <span className="copc-gh-owner">admin</span>
              <span className="copc-gh-sep">/</span>
              <span className="copc-gh-repo">copc-dashboard</span>
            </div>
            <h4 className="mb-1 copc-gh-title">{title}</h4>
            <p className="mb-0 small copc-gh-subtitle">
              Manage COPC workflow, task management, and program management in one place.
            </p>
          </div>
          <div className="copc-gh-repo-meta">
            <span className="copc-gh-pill">
              <FaCodeBranch className="me-1" />
              main
            </span>
            <span className="copc-gh-pill copc-gh-pill-active">{activeTabLabel}</span>
          </div>
        </div>

        <div className="copc-gh-tabbar">
          <div className="copc-gh-tabs" role="tablist" aria-label="COPC dashboard tabs">
            {Object.entries(TAB_CONFIG).map(([key, item]) => {
              const Icon = item.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  className={`copc-gh-tab ${isActive ? "is-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => openTab(key)}
                >
                  <Icon className="me-2" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="copc-gh-content">
          {activeTab === "workflow" && <CopcWorkflowPage />}
          {activeTab === "tasks" && <AdminTasksPage />}
          {activeTab === "programs" && <AdminCopcProgramsPage />}
        </div>
      </div>
    </div>
  );
}
