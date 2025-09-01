import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React from "react"
import Login from "./pages/Login";
import Home from "./pages/home"; // user page
import AdminHome from "./pages/adminhome"; // admin page
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout";
import Upload from "./pages/upload"; // upload page
import Shared from "./pages/shared"; // shared page

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login */}
        <Route path="/login" element={<Login />} />

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

      </Routes>
    </Router>
  );
}

export default App;
