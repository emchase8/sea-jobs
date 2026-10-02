import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SideMenu from "../Menu.js";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";

type ApplicantMatch = {
  job?: InterestedJob;
};

type InterestedJob = {
  id?: number;
  title?: string;
  company?: {
    username?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  location?: string;
  pay?: string | number;
  type?: string;
  description?: string;
  skills?: string[];
};

const Interested = () => {
  const navigate = useNavigate();
  const { auth } = useUserInfo();
  const [interestedJobs, setInterestedJobs] = useState<InterestedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);

  const showInterestedError = (message: string) => {
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

  useEffect(() => {
    const fetchInterestedJobs = async () => {
      if (!auth) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch("http://localhost:8000/api/matches/applicant/", {
          method: "GET",
          headers: {
            Authorization: `Token ${auth}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setInterestedJobs([]);
          showInterestedError(
            getInterestedErrorMessage(
              data,
              "Unable to load interested jobs right now. Please try again.",
            ),
          );
          return;
        }

        const matches = Array.isArray(data) ? data : [];
        setInterestedJobs(matches.map((match: ApplicantMatch) => match.job).filter(Boolean));
      } catch {
        setInterestedJobs([]);
        showInterestedError("Unable to load interested jobs right now. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInterestedJobs();
  }, [auth]);

  return (
    <>
      <SideMenu userType="applicant" />
      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Interested jobs error</strong>
            <button
              type="button"
              onClick={() => setShowErrorToast(false)}
              style={toastCloseButtonStyle}
              aria-label="Dismiss interested jobs error"
            >
              ×
            </button>
          </div>
          <p style={toastMessageStyle}>{errorMessage}</p>
        </div>
      )}
      <div
        style={{
          minHeight: "100vh",
          padding: "24px 16px",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            maxWidth: "860px",
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
            padding: "28px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "24px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "#0f172a", fontWeight: 700 }}>
                Your Interested Jobs
              </h1>
              <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "1rem" }}>
                Jobs you have swiped right on. Check your match status and get AI suggestions to draft your outreach email!
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/applicant/match")}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#16a34a",
                color: "#ffffff",
                padding: "12px 20px",
                fontWeight: 600,
                fontSize: "1rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
                transition: "background 0.2s ease, transform 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#15803d")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#16a34a")}
            >
              🔍 Find more jobs
            </button>
          </div>

          {loading ? (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: "14px",
                padding: "32px 20px",
                textAlign: "center",
                background: "#f8fafc",
              }}
            >
              <p style={{ margin: 0, fontSize: "1.1rem", color: "#475569" }}>
                Loading interested jobs...
              </p>
            </div>
          ) : interestedJobs.length === 0 ? (
            <div
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: "16px",
                padding: "48px 24px",
                textAlign: "center",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📂</div>
              <p style={{ margin: 0, fontSize: "1.25rem", color: "#1e293b", fontWeight: 600 }}>
                You have not saved any jobs yet.
              </p>
              <p style={{ margin: "8px 0 20px", color: "#64748b", fontSize: "0.95rem" }}>
                Browse available opportunities in the match deck and swipe right on jobs you like!
              </p>
              <button
                type="button"
                onClick={() => navigate("/applicant/match")}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "10px 20px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                Start swiping
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {interestedJobs.map((job, index) => (
                <div
                  key={`${job.id ?? job.title ?? "job"}-${index}`}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "18px",
                    background: "#f8fafc",
                  }}
                >
                  <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#0f172a" }}>
                    {job.title || "Untitled job"}
                  </h2>
                  <p style={{ margin: "0 0 10px", color: "#475569", fontWeight: 600 }}>
                    {formatCompanyName(job.company)}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <JobDetail label="Location" value={job.location} />
                    <JobDetail label="Type" value={formatJobType(job.type)} />
                    <JobDetail label="Pay" value={formatPay(job.pay)} />
                    <JobDetail label="Company email" value={job.company?.email} />
                  </div>
                  {job.description && (
                    <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.5 }}>
                      {job.description}
                    </p>
                  )}
                  {Array.isArray(job.skills) && job.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {job.skills.map((skill) => (
                        <span
                          key={skill}
                          style={{
                            borderRadius: "999px",
                            background: "#e0f2fe",
                            color: "#075985",
                            padding: "6px 10px",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const JobDetail = ({ label, value }: { label: string; value?: string | number }) => (
  <div>
    <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700 }}>
      {label}
    </div>
    <div style={{ color: "#0f172a", marginTop: "2px" }}>{value || "Not listed"}</div>
  </div>
);

const formatCompanyName = (company?: InterestedJob["company"]) =>
  [company?.first_name, company?.last_name].filter(Boolean).join(" ") ||
  company?.username ||
  "Company";

const formatPay = (pay?: string | number) => {
  if (pay === undefined || pay === null || pay === "") {
    return undefined;
  }

  const numericPay = Number(pay);

  if (Number.isNaN(numericPay)) {
    return String(pay);
  }

  return `$${numericPay.toLocaleString()} / year`;
};

const formatJobType = (type?: string) => {
  if (!type) {
    return undefined;
  }

  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getInterestedErrorMessage = (data: unknown, fallbackMessage: string) => {
  if (!data || typeof data !== "object") {
    return fallbackMessage;
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

  return fallbackMessage;
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

export default Interested;
