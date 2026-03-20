import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaBook,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaCodeBranch,
  FaLayerGroup,
  FaListUl,
  FaTasks,
} from "react-icons/fa";
import CopcWorkflowPage from "./copcworkflow";
import CopcUploadPage from "./copcupload";
import CopcDepartmentReviewPage from "./copcdeptreview";
import CopcQaReviewPage from "./copcqareview";
import CopcEvaluationPage from "./copcevaluation";
import CopcAssignedTasksPage from "./copcassignedtasks";
import AdminTasksPage from "./admintasks";
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

const TAB_CONFIG = {
  workflow: { label: "COPC Workflow", icon: FaLayerGroup },
  upload: { label: "COPC Upload", icon: FaCloudUploadAlt },
  tasks: { label: "Tasks Assigned to Me", icon: FaTasks },
  task_management: { label: "Task Management", icon: FaListUl },
  department_review: { label: "Department Review", icon: FaCheckCircle },
  qa_review: { label: "QA Compliance Review", icon: FaListUl },
  evaluation: { label: "Evaluation Stage", icon: FaCheckCircle },
};

export default function UserCopcDashboardPage({ defaultTab = "workflow" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userRole = normalizeRole(localStorage.getItem("role") || "faculty");

  const tabConfig = useMemo(() => {
    const canOpenUpload = !["evaluator", "superadmin"].includes(userRole);
    const canOpenDeptReview = ["dept_chair", "superadmin"].includes(userRole);
    const canOpenQaReview = ["qa_admin", "superadmin"].includes(userRole);
    const canOpenEvaluation = ["evaluator", "superadmin"].includes(userRole);
    const canOpenTaskManagement = ["dept_chair", "superadmin"].includes(userRole);

    return Object.fromEntries(
      Object.entries(TAB_CONFIG).filter(([key]) => {
        if (key === "upload") return canOpenUpload;
        if (key === "task_management") return canOpenTaskManagement;
        if (key === "department_review") return canOpenDeptReview;
        if (key === "qa_review") return canOpenQaReview;
        if (key === "evaluation") return canOpenEvaluation;
        return true;
      })
    );
  }, [userRole]);

  const fallbackTab = tabConfig[defaultTab] ? defaultTab : Object.keys(tabConfig)[0] || "workflow";
  const rawTab = String(searchParams.get("tab") || fallbackTab);
  const activeTab = tabConfig[rawTab] ? rawTab : fallbackTab;
  const activeTabLabel = tabConfig[activeTab]?.label || "COPC Workflow";

  const openTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tabKey);
    navigate(`/copc-dashboard?${nextParams.toString()}`);
  };

  return (
    <div className="container-fluid py-3 copc-dashboard-gh">
      <div className="copc-gh-shell">
        <div className="copc-gh-repo-header">
          <div className="copc-gh-repo-main">
            <div className="copc-gh-repo-path">
              <FaBook className="me-2" />
              <span className="copc-gh-owner">user</span>
              <span className="copc-gh-sep">/</span>
              <span className="copc-gh-repo">copc-dashboard</span>
            </div>
            <h4 className="mb-1 copc-gh-title">COPC Dashboard</h4>
            <p className="mb-0 small copc-gh-subtitle">
              Access COPC workflow, uploads, reviews, and your assigned compliance tasks in one place.
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
            {Object.entries(tabConfig).map(([key, item]) => {
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
        </div>
      </div>
    </div>
  );
}
