import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArchive,
  FaArrowRight,
  FaBook,
  FaCodeBranch,
  FaLayerGroup,
  FaListUl,
  FaShieldAlt,
} from "react-icons/fa";
import AdminTasksPage from "./admintasks";
import CopcWorkflowPage from "./copcworkflow";
import AdminCopcProgramsPage from "./admincopcprograms";
import "./admincopcdashboard.css";

const TAB_CONFIG = {
  workflow: {
    label: "COPC Workflow",
    icon: FaLayerGroup,
    description: "Track lifecycle phases, compliance checks, and final approval readiness.",
    tone: "workflow",
  },
  tasks: {
    label: "Task Management",
    icon: FaListUl,
    description: "Coordinate folder-level tasks, assignments, and progress monitoring.",
    tone: "tasks",
  },
  programs: {
    label: "Program Management",
    icon: FaArchive,
    description: "Filter, archive, and manage COPC programs and lock states.",
    tone: "programs",
  },
};

export default function AdminCopcDashboardPage({ defaultTab = "workflow" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const fallbackTab = TAB_CONFIG[defaultTab] ? defaultTab : "workflow";
  const rawTab = String(searchParams.get("tab") || fallbackTab);
  const activeTab = TAB_CONFIG[rawTab] ? rawTab : fallbackTab;
  const tabEntries = Object.entries(TAB_CONFIG);

  const openTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tabKey);
    navigate(`/admin/copc-dashboard?${nextParams.toString()}`);
  };

  const isCanonicalRoute = location.pathname === "/admin/copc-dashboard";
  const title = isCanonicalRoute ? "COPC Admin Dashboard" : "COPC Dashboard";
  const activeTabLabel = TAB_CONFIG[activeTab]?.label || "COPC Workflow";
  const activeIndex = Math.max(
    0,
    tabEntries.findIndex(([tabKey]) => tabKey === activeTab)
  );
  const healthScore = Math.min(
    98,
    70 + Math.round(((activeIndex + 1) / Math.max(tabEntries.length, 1)) * 24)
  );

  return (
    <div className="container-fluid py-3 copc-dashboard-gh">
      <div className="copc-glass-shell">
        <header className="copc-glass-hero">
          <div className="copc-glass-hero-main">
            <div className="copc-glass-kicker">
              <FaBook />
              <span>Azure Ledger / admin / copc-dashboard</span>
            </div>
            <h1 className="copc-glass-title">{title}</h1>
            <p className="copc-glass-subtitle">
              Manage COPC workflow, task management, and program management in one place.
            </p>
            <div className="copc-glass-meta">
              <span className="copc-glass-pill">
                <FaCodeBranch className="me-1" />
                main
              </span>
              <span className="copc-glass-pill copc-glass-pill-active">{activeTabLabel}</span>
            </div>
          </div>
          <aside className="copc-health-card" aria-label="Compliance health score">
            <div className="copc-health-ring" style={{ "--copc-health": `${healthScore}%` }}>
              <span>{healthScore}%</span>
            </div>
            <div>
              <div className="copc-health-label">Archival Health Score</div>
              <div className="copc-health-status">Ready to Audit</div>
              <div className="copc-health-note">Admin controls and workflow actions available.</div>
            </div>
          </aside>
        </header>

        <section className="copc-step-grid" aria-label="COPC dashboard modules">
          {tabEntries.map(([tabKey, item], index) => {
            const Icon = item.icon;
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                className={`copc-step-card tone-${item.tone} ${isActive ? "is-active" : ""}`}
                type="button"
                onClick={() => openTab(tabKey)}
              >
                <div className="copc-step-head">
                  <span className="copc-step-badge">Step {String(index + 1).padStart(2, "0")}</span>
                  <Icon className="copc-step-icon" />
                </div>
                <div className="copc-step-title">{item.label}</div>
                <div className="copc-step-copy">{item.description}</div>
                <div className="copc-step-progress">
                  <div className="copc-step-progress-fill" style={{ width: `${(index + 1) * 30 + 10}%` }} />
                </div>
              </button>
            );
          })}
        </section>

        <div className="copc-main-layout">
          <section className="copc-main-content">
            <div className="copc-gh-tabbar">
              <div className="copc-gh-tabs" role="tablist" aria-label="COPC dashboard tabs">
                {tabEntries.map(([key, item]) => {
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
          </section>

          <aside className="copc-right-rail">
            <div className="copc-rail-card">
              <div className="copc-rail-heading">Admin Activity</div>
              <ul className="copc-activity-list">
                {tabEntries.map(([key, item]) => (
                  <li key={key}>
                    <button
                      type="button"
                      className={`copc-activity-item ${activeTab === key ? "is-active" : ""}`}
                      onClick={() => openTab(key)}
                    >
                      <span>{item.label}</span>
                      <FaArrowRight />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="copc-rail-card copc-help-card">
              <div className="copc-rail-heading">Need Help?</div>
              <p className="mb-0">
                Review role assignments and run final compliance checks before locking submissions.
              </p>
              <div className="copc-help-inline">
                <FaShieldAlt />
                <span>Secure COPC workflow governance enabled</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
