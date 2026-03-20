import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import logo from "../assets/dblogo2.png";
import { BACKEND_URL } from "../config";
import "./login.css";

function Login() {
  const [view, setView] = useState("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const [signinForm, setSigninForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
  });
  const [registerCodeSent, setRegisterCodeSent] = useState(false);
  const [forgotForm, setForgotForm] = useState({ email: "" });
  const [resetForm, setResetForm] = useState({
    email: "",
    code: "",
    password: "",
    confirmPassword: "",
  });
  const navigate = useNavigate();

  const cardCopy = useMemo(() => {
    switch (view) {
      case "register":
        return {
          title: "Create your DocuDB account",
          subtitle: "Verify your @llcc.edu.ph email to complete registration.",
        };
      case "forgot":
        return {
          title: "Forgot your password?",
          subtitle: "Enter your account email to request a reset code.",
        };
      case "reset":
        return {
          title: "Reset your password",
          subtitle: "Use your reset code and set a new password.",
        };
      default:
        return {
          title: "Welcome to DocuDB",
          subtitle: "Sign in to continue to your document workspace.",
        };
    }
  }, [view]);

  const setMessage = (message, type = "danger") => {
    setFeedback({ message, type });
  };

  const clearMessage = () => {
    setFeedback({ message: "", type: "" });
  };

  const handleAuthSuccess = (result, fallbackEmail) => {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", result.role);
    localStorage.setItem("userId", result.userId);
    localStorage.setItem("email", result.email || fallbackEmail || "");
    localStorage.setItem("name", result.name || "");
    localStorage.setItem("department", result.department || "");
    if (result.profilePicture) {
      localStorage.setItem("profilePicture", result.profilePicture);
      localStorage.setItem("profilePictureUpdatedAt", String(Date.now()));
    } else {
      localStorage.removeItem("profilePicture");
      localStorage.setItem("profilePictureUpdatedAt", String(Date.now()));
    }

    if (result.role === "superadmin") navigate("/admin");
    else navigate("/");
  };

  const extractError = (err, fallback) => {
    if (err.response?.data?.error) return err.response.data.error;
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return fallback;
  };

  const handleSigninSubmit = async (e) => {
    e.preventDefault();
    clearMessage();
    setIsSubmitting(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/auth/login`, signinForm);
      const payload = response.data || {};

      if (
        payload.status === "success" ||
        payload.success === true ||
        (payload.role && payload.userId)
      ) {
        handleAuthSuccess(payload, signinForm.email);
        return;
      }

      if (payload.status === "2fa_required") {
        setMessage(
          "Your backend still requires login verification code. Restart the server to apply the latest no-login-OTP changes.",
          "error"
        );
        return;
      }

      setMessage(payload.error || payload.message || "Unexpected login response. Please try again.");
    } catch (err) {
      setMessage(extractError(err, "Login failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendRegisterCode = async () => {
    clearMessage();
    const email = registerForm.email.trim().toLowerCase();

    if (!email.endsWith("@llcc.edu.ph")) {
      setMessage("Registration is limited to @llcc.edu.ph emails.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/register/send-code`, { email });
      setRegisterCodeSent(true);
      setRegisterForm((prev) => ({ ...prev, email }));
      setMessage(
        response.data?.message || "Verification code sent to your email.",
        "success"
      );
    } catch (err) {
      setMessage(extractError(err, "Failed to send verification code"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    clearMessage();

    const email = registerForm.email.trim().toLowerCase();
    if (!email.endsWith("@llcc.edu.ph")) {
      setMessage("Registration is limited to @llcc.edu.ph emails.");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (!registerForm.code.trim()) {
      setMessage("Verification code is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/register`, {
        name: registerForm.name,
        email,
        password: registerForm.password,
        code: registerForm.code.trim(),
      });
      setMessage(response.data?.message || "Registration successful. Please sign in.", "success");
      setSigninForm((prev) => ({ ...prev, email, password: "" }));
      setRegisterForm({
        name: "",
        email,
        password: "",
        confirmPassword: "",
        code: "",
      });
      setRegisterCodeSent(false);
      setView("signin");
    } catch (err) {
      setMessage(extractError(err, "Registration failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    clearMessage();
    setIsSubmitting(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/auth/forgot-password`, forgotForm);
      setMessage(response.data?.message || "If your account exists, a reset code has been sent.", "success");
      setResetForm({
        email: forgotForm.email.trim().toLowerCase(),
        code: "",
        password: "",
        confirmPassword: "",
      });
      setView("reset");
    } catch (err) {
      setMessage(extractError(err, "Failed to request reset code"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    clearMessage();

    if (resetForm.password !== resetForm.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/reset-password`, {
        email: resetForm.email.trim().toLowerCase(),
        code: resetForm.code,
        newPassword: resetForm.password,
      });
      setMessage(response.data?.message || "Password reset successful. Please sign in.", "success");
      setSigninForm((prev) => ({
        ...prev,
        email: resetForm.email.trim().toLowerCase(),
        password: "",
      }));
      setResetForm({ email: "", code: "", password: "", confirmPassword: "" });
      setView("signin");
    } catch (err) {
      setMessage(extractError(err, "Failed to reset password"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-card card">
          <div className="login-brand">
            <img src={logo} alt="DocuDB Logo" className="login-logo" />
            <h1>{cardCopy.title}</h1>
            <p>{cardCopy.subtitle}</p>
          </div>

          {feedback.message && (
            <div
              className={`alert alert-${feedback.type === "success" ? "success" : "danger"} py-2`}
              role="alert"
            >
              {feedback.message}
            </div>
          )}

          {view === "signin" && (
            <form onSubmit={handleSigninSubmit} className="login-form">
              <div className="mb-3">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Doe.John@llcc.edu.ph"
                  value={signinForm.email}
                  onChange={(e) => setSigninForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter your password"
                  value={signinForm.password}
                  onChange={(e) => setSigninForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>

              <div className="login-links">
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => {
                    clearMessage();
                    setRegisterCodeSent(false);
                    setView("register");
                  }}
                >
                  Create account
                </button>
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => {
                    clearMessage();
                    setForgotForm({ email: signinForm.email });
                    setView("forgot");
                  }}
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {view === "register" && (
            <form onSubmit={handleRegisterSubmit} className="login-form">
              <div className="mb-3">
                <label className="form-label">Full name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Juan Dela Cruz"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">LLCC email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="first.last@llcc.edu.ph"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Verification code</label>
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control code-input"
                    placeholder="6-digit code"
                    value={registerForm.code}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        code: e.target.value.replace(/\D/g, "").slice(0, 8),
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={handleSendRegisterCode}
                    disabled={isSubmitting}
                  >
                    {registerCodeSent ? "Resend" : "Send code"}
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Create a password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Confirm password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Re-enter password"
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </button>

              <div className="login-links login-links-single">
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => {
                    clearMessage();
                    setView("signin");
                  }}
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgotSubmit} className="login-form">
              <div className="mb-3">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Doe.John@llcc.edu.ph"
                  value={forgotForm.email}
                  onChange={(e) => setForgotForm({ email: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
                {isSubmitting ? "Sending code..." : "Send reset code"}
              </button>

              <div className="login-links login-links-single">
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => {
                    clearMessage();
                    setView("signin");
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {view === "reset" && (
            <form onSubmit={handleResetSubmit} className="login-form">
              <div className="mb-3">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  value={resetForm.email}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Reset code</label>
                <input
                  type="text"
                  className="form-control code-input"
                  placeholder="6-digit code"
                  value={resetForm.code}
                  onChange={(e) =>
                    setResetForm((prev) => ({
                      ...prev,
                      code: e.target.value.replace(/\D/g, "").slice(0, 8),
                    }))
                  }
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">New password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter new password"
                  value={resetForm.password}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Confirm new password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Confirm new password"
                  value={resetForm.confirmPassword}
                  onChange={(e) =>
                    setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
                {isSubmitting ? "Resetting..." : "Reset password"}
              </button>

              <div className="login-links login-links-single">
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => {
                    clearMessage();
                    setView("signin");
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          <p className="login-version">Version 3.1.0 | Made proudly by LLCC students</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
