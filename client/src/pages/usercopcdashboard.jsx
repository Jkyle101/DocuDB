import React, { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArrowRight,
  FaBook,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaCodeBranch,
  FaLayerGroup,
  FaListUl,
  FaTasks,
  FaUserShield,
} from "react-icons/fa";
import CopcWorkflowPage from "./copcworkflow";
import CopcUploadPage from "./copcupload";
import CopcDepartmentReviewPage from "./copcdeptreview";
import CopcQaReviewPage from "./copcqareview";
import CopcEvaluationPage from "./copcevaluation";
import CopcAssignedTasksPage from "./copcassignedtasks";
import AdminTasksPage from "./admintasks";
import AdminCopcProgramsPage from "./admincopcprograms";
import "./admincopcdashboard.css";

const normalizeRole = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw === "admin") return "superadmin";
  if (raw === "user") return "faculty";
  if (["program_chair", "department_chair", "program_head"].includes(raw)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(raw)) return "qa_admin";
  if (raw === "reviewer") return "evaluator";
  return raw;
};

const ROLE_LABELS = {
  superadmin: "Super Admin",
  qa_admin: "QA Admin",
  dept_chair: "Department Chair",
  faculty: "Faculty",
  evaluator: "Evaluator",
};

const TAB_CONFIG = {
  workflow: {
    label: "COPC Workflow",
    icon: FaLayerGroup,
    description: "Monitor lifecycle phases, compliance progress, and readiness signals.",
    tone: "workflow",
  },
  upload: {
    label: "COPC Upload",
    icon: FaCloudUploadAlt,
    description: "Upload and organize compliance evidence for your assigned folders.",
    tone: "upload",
  },
  tasks: {
    label: "Tasks Assigned to Me",
    icon: FaTasks,
    description: "Track your assigned deliverables and completion responsibilities.",
    tone: "tasks",
  },
  task_management: {
    label: "Task Management",
    icon: FaListUl,
    description: "Create and coordinate folder-level tasks across the COPC workspace.",
    tone: "tasks",
  },
  department_review: {
    label: "Department Review",
    icon: FaCheckCircle,
    description: "Validate faculty submissions before QA-level compliance checks.",
    tone: "review",
  },
  qa_review: {
    label: "QA Compliance Review",
    icon: FaListUl,
    description: "Review and verify compliance artifacts across department submissions.",
    tone: "review",
  },
  evaluation: {
    label: "Evaluation Stage",
    icon: FaCheckCircle,
    description: "Capture final observations and complete internal evaluation workflow.",
    tone: "evaluation",
  },
  programs: {
    label: "Program Management",
    icon: FaListUl,
    description: "Filter, archive, and manage COPC programs and lock states.",
    tone: "programs",
  },
};

export default function UserCopcDashboardPage({ defaultTab = "workflow" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const userRole = normalizeRole(localStorage.getItem("role") || "faculty");
  const roleDisplay = ROLE_LABELS[userRole] || "COPC User";
  const isAdminContext = location.pathname.startsWith("/admin/");

  const tabConfig = useMemo(() => {
    const canOpenUpload = !["evaluator", "superadmin"].includes(userRole);
    const canOpenDeptReview = ["dept_chair", "superadmin"].includes(userRole);
    const canOpenQaReview = ["qa_admin", "superadmin"].includes(userRole);
    const canOpenEvaluation = ["evaluator", "superadmin"].includes(userRole);
    const canOpenTaskManagement = ["dept_chair", "superadmin"].includes(userRole);
    const canOpenProgramManagement = userRole === "superadmin";

    return Object.fromEntries(
      Object.entries(TAB_CONFIG).filter(([key]) => {
        if (key === "tasks" && isAdminContext) return false;
        if (key === "upload") return canOpenUpload;
        if (key === "task_management") return canOpenTaskManagement;
        if (key === "department_review") return canOpenDeptReview;
        if (key === "qa_review") return canOpenQaReview;
        if (key === "evaluation") return canOpenEvaluation;
        if (key === "programs") return canOpenProgramManagement;
        return true;
      })
    );
  }, [isAdminContext, userRole]);

  const tabEntries = useMemo(() => Object.entries(tabConfig), [tabConfig]);
  const fallbackTab = tabConfig[defaultTab] ? defaultTab : tabEntries[0]?.[0] || "workflow";
  const rawTab = String(searchParams.get("tab") || fallbackTab);
  const activeTab = tabConfig[rawTab] ? rawTab : fallbackTab;
  const activeTabLabel = tabConfig[activeTab]?.label || "COPC Workflow";

  const activeIndex = Math.max(
    0,
    tabEntries.findIndex(([tabKey]) => tabKey === activeTab)
  );
  const healthScore = Math.min(
    98,
    72 + Math.round(((activeIndex + 1) / Math.max(tabEntries.length, 1)) * 22)
  );

  const highlightCards = useMemo(() => {
    const preferredOrder = [
      "upload",
      "department_review",
      "qa_review",
      "evaluation",
      "tasks",
      "task_management",
      "programs",
      "workflow",
    ];
    const keys = preferredOrder.filter((key) => !!tabConfig[key]);
    const cardKeys = (keys.length ? keys : tabEntries.map(([key]) => key)).slice(0, 3);
    return cardKeys.map((key, index) => ({
      key,
      step: index + 1,
      progress: Math.min(100, 34 + index * 26),
      ...tabConfig[key],
    }));
  }, [tabConfig, tabEntries]);

  const openTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tabKey);
    const basePath = location.pathname.startsWith("/admin/")
      ? "/admin/copc-dashboard"
      : "/copc-dashboard";
    navigate(`${basePath}?${nextParams.toString()}`);
  };

  return (
    <div className="container-fluid py-3 copc-dashboard-gh">
      <div className="copc-glass-shell">
        <header className="copc-glass-hero">
          <div className="copc-glass-hero-main">
            <div className="copc-glass-kicker">
              <FaBook />
              <span>Azure Ledger / user / copc-dashboard</span>
            </div>
            <h1 className="copc-glass-title">COPC Dashboard</h1>
            <p className="copc-glass-subtitle">
              Access COPC workflow, uploads, reviews, and your assigned compliance tasks in one place.
            </p>
            <div className="copc-glass-meta">
              <span className="copc-glass-pill">
                <FaCodeBranch className="me-1" />
                main
              </span>
              <span className="copc-glass-pill">{roleDisplay}</span>
              <span className="copc-glass-pill copc-glass-pill-active">{activeTabLabel}</span>
            </div>
          </div>
          <aside className="copc-health-card" aria-label="Compliance health score">
            <div className="copc-health-ring" style={{ "--copc-health": `${healthScore}%` }}>
              <span>{healthScore}%</span>
            </div>
            <div>
              <div className="copc-health-label">Compliance Health</div>
              <div className="copc-health-status">Ready to Review</div>
              <div className="copc-health-note">Role-based workflow access configured.</div>
            </div>
          </aside>
        </header>

        <section className="copc-step-grid" aria-label="COPC key phases">
          {highlightCards.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                className={`copc-step-card tone-${item.tone} ${isActive ? "is-active" : ""}`}
                type="button"
                onClick={() => openTab(item.key)}
              >
                <div className="copc-step-head">
                  <span className="copc-step-badge">Step {String(item.step).padStart(2, "0")}</span>
                  <Icon className="copc-step-icon" />
                </div>
                <div className="copc-step-title">{item.label}</div>
                <div className="copc-step-copy">{item.description}</div>
                <div className="copc-step-progress">
                  <div className="copc-step-progress-fill" style={{ width: `${item.progress}%` }} />
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
              {activeTab === "upload" && <CopcUploadPage />}
              {activeTab === "tasks" && <CopcAssignedTasksPage />}
              {activeTab === "task_management" && <AdminTasksPage />}
              {activeTab === "department_review" && <CopcDepartmentReviewPage />}
              {activeTab === "qa_review" && <CopcQaReviewPage />}
              {activeTab === "evaluation" && <CopcEvaluationPage />}
              {activeTab === "programs" && <AdminCopcProgramsPage />}
            </div>
          </section>

          <aside className="copc-right-rail">
            <div className="copc-rail-card">
              <div className="copc-rail-heading">Role Shortcuts</div>
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
              <div className="copc-rail-heading">Compliance Guidance</div>
              <p className="mb-0">
                Assigned role: {roleDisplay}. Use the highlighted modules to complete your COPC cycle tasks.
              </p>
              <div className="copc-help-inline">
                <FaUserShield />
                <span>Permission-based modules are active</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
