import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import React, { useEffect, useRef, useState } from "react";
import Login from "./pages/login.jsx";
import Home from "./pages/home"; // user page
import AdminOwnedPage from "./pages/adminowned";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout";
import Upload from "./pages/upload"; // upload page
import Shared from "./pages/shared"; // shared page
import Recent from "./pages/recent"; // recent page
import MyGroups from "./pages/mygroups"; // my groups page
import ManageUsers from "./pages/adminside/manageusers"; // manage users page
import SystemLogs from "./pages/adminside/systemlogs.jsx"; //system logs
import ManageGroups from "./pages/adminside/managegroups"; // manage groups page
import AdminTrash from "./pages/adminside/trash"; // admin trash page
import CopcUploadPage from "./pages/copcupload";
import CopcDepartmentReviewPage from "./pages/copcdeptreview";
import CopcQaReviewPage from "./pages/copcqareview";
import CopcEvaluationPage from "./pages/copcevaluation";
import CopcSubmissionsPage from "./pages/copcsubmissions";
import UserCopcDashboardPage from "./pages/usercopcdashboard";
import AdminCopcDashboardPage from "./pages/admincopcdashboard";
import AdminCopcArchivedPage from "./pages/admincopcarchived";
import AdminCopcRecentUploadsPage from "./pages/admincopcrecentuploads";
import Settings from "./pages/settings"; // user settings page
import Notifications from "./pages/notifications"; // user notifications page
import Help from "./pages/help"; // help & feedback page
import FormsPage from "./pages/forms.jsx"; // smart form builder
import EditorPage from "./pages/editor.jsx"; // full-page document editor
import LoadingScreen from "./components/LoadingScreen";

const USER_ALLOWED_ROLES = [
  "superadmin",
  "qa_admin",
  "dept_chair",
  "user",
  "evaluator",
];

function AppRoutes() {
  return (
    <Routes>
      {/* Public Login */}
      <Route path="/login" element={<Login />} />

      {/* User Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />{" "}
      </Route>

      <Route path="upload" element={<Upload />} />

      <Route
        path="/shared"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Shared />} />
      </Route>

      <Route
        path="/recent"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Recent />} />
      </Route>

      <Route
        path="/groups"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<MyGroups />} />
      </Route>

      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Settings />} />
      </Route>

      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Notifications />} />
      </Route>

      <Route
        path="/help"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Help />} />
      </Route>

      <Route
        path="/forms"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<FormsPage />} />
      </Route>

      <Route
        path="/editor/:id"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<EditorPage />} />
      </Route>
      <Route
        path="/copc-dashboard"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserCopcDashboardPage />} />
      </Route>
      <Route
        path="/copc-workflow"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserCopcDashboardPage defaultTab="workflow" />} />
      </Route>
      <Route
        path="/copc-workflow/upload"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "qa_admin", "dept_chair", "user"]}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<CopcUploadPage />} />
      </Route>
      <Route
        path="/copc-workflow/department-review"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "dept_chair"]}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<CopcDepartmentReviewPage />} />
      </Route>
      <Route
        path="/copc-workflow/qa-review"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "qa_admin"]}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<CopcQaReviewPage />} />
      </Route>
      <Route
        path="/copc-workflow/evaluation"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "evaluator"]}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<CopcEvaluationPage />} />
      </Route>
      <Route
        path="/copc-workflow/submissions"
        element={
          <ProtectedRoute allowedRoles={USER_ALLOWED_ROLES}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<CopcSubmissionsPage />} />
      </Route>
      <Route
        path="/copc-recent-uploads"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "dept_chair", "qa_admin"]}>
            <Layout role="user" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminCopcRecentUploadsPage />} />
      </Route>

      {/* Admin Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOwnedPage />} />
      </Route>
      <Route
        path="/admin/drive"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOwnedPage defaultScope="all" />} />
      </Route>

      <Route
        path="/admin/manageusers"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<ManageUsers />} />
      </Route>
      <Route
        path="/admin/systemlogs"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<SystemLogs />} />
      </Route>
      <Route
        path="/admin/groups"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<ManageGroups />} />
      </Route>
      <Route
        path="/admin/trash"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminTrash />} />
      </Route>
      <Route
        path="/admin/owned"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOwnedPage defaultScope="owned" />} />
      </Route>
      <Route
        path="/admin/copc-dashboard"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminCopcDashboardPage defaultTab="workflow" />} />
      </Route>
      <Route
        path="/admin/tasks"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminCopcDashboardPage defaultTab="tasks" />} />
      </Route>
      <Route
        path="/admin/copc-programs"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminCopcDashboardPage defaultTab="programs" />} />
      </Route>
      <Route
        path="/admin/copc-archived"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminCopcArchivedPage />} />
      </Route>
      <Route
        path="/admin/copc-recent-uploads"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminCopcRecentUploadsPage />} />
      </Route>
      <Route
        path="/admin/copc-workflow/submissions"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<CopcSubmissionsPage />} />
      </Route>
    </Routes>
  );
}

function AppShell() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const firstLoad = useRef(true);

  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(() => {
      setIsLoading(false);
      firstLoad.current = false;
    }, firstLoad.current ? 950 : 380);
    return () => clearTimeout(timeout);
  }, [location.pathname, location.search, location.hash]);

  return (
    <>
      {isLoading && <LoadingScreen message="Loading DocuDB..." />}
      <AppRoutes />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;

