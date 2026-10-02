import { CompanyUser } from "shared";
import { useUserInfoActions } from "../../../userInfo/userInfoHooks.js";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const CompanyRegister = () => {
  const { updateUserInfo } = useUserInfoActions();
  const nav = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);

  const showRegisterError = (message: string) => {
    setErrorMessage(message);
    setShowErrorToast(true);
  };

  useEffect(() => {
    if (!showErrorToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowErrorToast(false);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [showErrorToast, errorMessage]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const company = new CompanyUser(
      String(formData.get("companyName") || ""),
      String(formData.get("password") || ""),
      String(formData.get("email") || ""),
      String(formData.get("description") || ""),
    );

    try {
      const response = await fetch(
        "http://localhost:8000/api/auth/register/recruiter/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: company.companyName,
            email: company.email,
            first_name: company.companyName,
            last_name: company.companyName,
            password: company.password,
            description: null,
          }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        company.userID = data["profile"]["id"];
        updateUserInfo(company, data["token"]);
        nav("/company/jobs");
      } else {
        console.log("SAD :(");
        console.log(data);
        showRegisterError(getRegistrationErrorMessage(data));
      }
    } catch {
      showRegisterError("Unable to register right now. Please try again.");
    }
  };

  return (
    <div style={pageShellStyle}>
      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Registration failed</strong>
            <button
              type="button"
              onClick={() => setShowErrorToast(false)}
              style={toastCloseButtonStyle}
              aria-label="Dismiss registration error"
            >
              ×
            </button>
          </div>
          <p style={toastMessageStyle}>{errorMessage}</p>
        </div>
      )}

      <div style={cardStyle}>
        <h1 style={headingStyle}>Company Registration</h1>
        <p style={subtitleStyle}>Create your company profile below.</p>

        <form onSubmit={handleSubmit} style={formStyle}>
          <div>
            <label htmlFor="companyName" style={labelStyle}>
              Company Name
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              required
              placeholder="Enter your company name"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="email" style={labelStyle}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="jobs@yourcompany.com"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Choose a password"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="description" style={labelStyle}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              required
              placeholder="Tell applicants about your company"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <button type="submit" style={primaryButtonStyle}>
            Register
          </button>
        </form>
      </div>
    </div>
  );
};

const pageShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "24px 12px",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  background: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  padding: "28px 24px",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "2rem",
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: "0 0 24px",
  color: "#475569",
  fontSize: "0.98rem",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: "18px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontWeight: 600,
  color: "#1e293b",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: "1rem",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#111827",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 600,
};

const getRegistrationErrorMessage = (data: unknown) => {
  if (!data || typeof data !== "object") {
    return "Registration failed. Please check your information and try again.";
  }

  const errorData = data as Record<string, unknown>;
  const directMessage = errorData.detail || errorData.error || errorData.message;

  if (typeof directMessage === "string") {
    return directMessage;
  }

  for (const value of Object.values(errorData)) {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }

  return "Registration failed. Please check your information and try again.";
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  top: "24px",
  right: "24px",
  zIndex: 1000,
  width: "min(360px, calc(100vw - 32px))",
  padding: "14px 16px",
  background: "#b91c1c",
  color: "#ffffff",
  borderRadius: "10px",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
};

const toastHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "6px",
};

const toastCloseButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "1.25rem",
  lineHeight: 1,
  padding: "0 2px",
};

const toastMessageStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
};

export default CompanyRegister;
