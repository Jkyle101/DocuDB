import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArchive,
  FaArrowRight,
  FaLayerGroup,
  FaListUl,
  FaShieldAlt,
  FaTasks,
} from "react-icons/fa";
import AdminTasksPage from "./admintasks";
import AdminAllTasksPage from "./adminalltasks";
import CopcWorkflowPage from "./copcworkflow";
import AdminCopcProgramsPage from "./admincopcprograms";
import { fetchCopcHealthSnapshot } from "../utils/copcHealth";
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
  all_tasks: {
    label: "All Tasks",
    icon: FaTasks,
    description: "Review every COPC task across programs, folders, assignees, and due dates.",
    tone: "alltasks",
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
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role") || "superadmin";
  const selectedProgramId = String(searchParams.get("programId") || "");
  const [healthSnapshot, setHealthSnapshot] = useState({
    score: 0,
    status: "Syncing...",
    note: "Fetching live COPC metrics...",
    loading: true,
  });

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
  const healthToneClass = useMemo(() => {
    const rawScore = Number(healthSnapshot.score);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : 0;
    if (healthSnapshot.loading) return "is-syncing";
    if (score <= 20) return "is-battery-empty";
    if (score <= 40) return "is-battery-low";
    if (score <= 60) return "is-battery-mid";
    if (score <= 80) return "is-battery-high";
    return "is-battery-full";
  }, [healthSnapshot.loading, healthSnapshot.score]);

  const refreshHealth = useCallback(async () => {
    try {
      const snapshot = await fetchCopcHealthSnapshot({
        userId,
        role,
        preferredProgramId: selectedProgramId,
      });
      setHealthSnapshot({
        ...snapshot,
        loading: false,
      });
    } catch {
      setHealthSnapshot({
        score: 0,
        status: "Unavailable",
        note: "Failed to load live COPC metrics.",
        loading: false,
      });
    }
  }, [role, selectedProgramId, userId]);

  useEffect(() => {
    setHealthSnapshot((prev) => ({
      ...prev,
      loading: true,
    }));
    refreshHealth();

    const timer = setInterval(refreshHealth, 10000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshHealth();
    };
    const onFocus = () => refreshHealth();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshHealth]);

  return (
    <div className="container-fluid py-3 copc-dashboard-gh">
      <div className="copc-glass-shell">
        <header className="copc-glass-hero">
          <div className="copc-glass-hero-main">
            <h1 className="copc-glass-title">{title}</h1>
            <p className="copc-glass-subtitle">
              Manage COPC workflow, task management, and program management in one place.
            </p>
            <div className="copc-glass-meta">
              <span className="copc-glass-pill copc-glass-pill-active">{activeTabLabel}</span>
            </div>
          </div>
          <aside className={`copc-health-card ${healthToneClass}`} aria-label="Compliance health score">
            <div className="copc-health-ring" style={{ "--copc-health": `${healthSnapshot.score}%` }}>
              <span>{healthSnapshot.score}%</span>
            </div>
            <div>
              <div className="copc-health-label">Archival Health Score</div>
              <div className="copc-health-status">
                {healthSnapshot.loading ? "Syncing..." : healthSnapshot.status}
              </div>
              <div className="copc-health-note">
                {healthSnapshot.loading ? "Fetching live COPC metrics..." : healthSnapshot.note}
              </div>
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
              {activeTab === "all_tasks" && <AdminAllTasksPage />}
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
