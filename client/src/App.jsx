import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React from "react";
import Login from "./pages/login.jsx";
import Home from "./pages/home"; // user page
import AdminHome from "./pages/adminhome"; // admin page
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout";
import Upload from "./pages/upload"; // upload page
import Shared from "./pages/shared"; // shared page
import Recent from "./pages/recent"; // recent page
import Trash from "./pages/trash"; // trash page
import MyGroups from "./pages/mygroups"; // my groups page
import ManageUsers from "./pages/adminside/manageusers"; // manage users page
import SystemLogs from "./pages/adminside/systemlogs.jsx"; //system logs
import ManageGroups from "./pages/adminside/managegroups"; // manage groups page
import AdminTrash from "./pages/adminside/trash"; // admin trash page
import Settings from "./pages/settings"; // user settings page
import Notifications from "./pages/notifications"; // user notifications page
import Help from "./pages/help"; // help & feedback page

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login */}
        <Route path="/login" element={<Login />} />

        {/* User Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRole="user">
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
            <ProtectedRoute allowedRole="user">
              <Layout role="user" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Shared />} />
        </Route>



        <Route
          path="/recent"
          element={
            <ProtectedRoute allowedRole="user">
              <Layout role="user" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Recent />} />
        </Route>

        <Route
          path="/groups"
          element={
            <ProtectedRoute allowedRole="user">
              <Layout role="user" />
            </ProtectedRoute>
          }
        >
          <Route index element={<MyGroups />} />
        </Route>

        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRole="user">
              <Layout role="user" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Settings />} />
        </Route>

        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRole="user">
              <Layout role="user" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Notifications />} />
        </Route>

        <Route
          path="/help"
          element={
            <ProtectedRoute allowedRole="user">
              <Layout role="user" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Help />} />
        </Route>

        {/* Admin Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout role="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminHome />} />
        </Route>

        <Route
          path="/admin/manageusers"
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout role="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<ManageUsers />} />
        </Route>
        <Route
          path="/admin/systemlogs"
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout role="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<SystemLogs />} />
        </Route>
        <Route
          path="/admin/groups"
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout role="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<ManageGroups />} />
        </Route>
        <Route
          path="/admin/trash"
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout role="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminTrash />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
