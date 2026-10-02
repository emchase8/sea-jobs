import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SideMenu from "../Menu.js";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";

type ApplicantResume = {
  id?: number;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_email?: string;
  summary?: string;
  skills?: string[];
  experiences?: {
    title?: string;
    company?: string;
    type?: string;
    description?: string;
  }[];
  education?: {
    school?: string;
    degree?: string;
    degree_type?: string;
    focus?: string;
    gpa?: string | number;
  }[];
};

type RecruiterMatch = {
  id?: number;
  resume?: ApplicantResume;
  applicant_swiped_yes?: boolean | null;
  employer_swiped_yes?: boolean | null;
  is_mutual_match?: boolean;
};

const CompanyInterested = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { auth } = useUserInfo();
  const selectedJobId = searchParams.get("job_id") || "";
  const [matches, setMatches] = useState<RecruiterMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
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
    const fetchMatches = async () => {
      if (!auth || !selectedJobId) {
        setMatches([]);
        return;
      }

      setMatchesLoading(true);

      try {
        const response = await fetch(
          `http://localhost:8000/api/matches/recruiter/${selectedJobId}/`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${auth}`,
              "Content-Type": "application/json",
            },
          },
        );
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setMatches([]);
          showInterestedError(
            getInterestedErrorMessage(
              data,
              "Unable to load interested applicants right now. Please try again.",
            ),
          );
          return;
        }

        setMatches(Array.isArray(data) ? data : []);
      } catch {
        setMatches([]);
        showInterestedError("Unable to load interested applicants right now. Please try again.");
      } finally {
        setMatchesLoading(false);
      }
    };

    fetchMatches();
  }, [auth, selectedJobId]);

  return (
    <>
      <SideMenu userType="company" />
      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Interested applicants error</strong>
            <button
              type="button"
              onClick={() => setShowErrorToast(false)}
              style={toastCloseButtonStyle}
              aria-label="Dismiss interested applicants error"
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
        }}
      >
        <div
          style={{
            maxWidth: "820px",
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
            padding: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "#0f172a" }}>
                Interested applicants
              </h1>
              <p style={{ margin: "8px 0 0", color: "#475569" }}>
                Applicants who have matched with your job listings.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/company/jobs")}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#2563eb",
                color: "#ffffff",
                padding: "12px 18px",
                fontWeight: 600,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              My jobs
            </button>
          </div>

          {matchesLoading ? (
            <EmptyState text="Loading interested applicants..." />
          ) : !selectedJobId ? (
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
                Select a job from your listings to review interested applicants.
              </p>
              <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                Go back to My jobs and choose Interested applicants on a job listing.
              </p>
            </div>
          ) : matches.length === 0 ? (
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
                No matched applicants for this job yet.
              </p>
              <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                Keep reviewing applicant matches to find mutual interest.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {matches.map((match, index) => {
                const resume = match.resume;
                const isMutualMatch = Boolean(
                  match.is_mutual_match ||
                    (match.applicant_swiped_yes === true && match.employer_swiped_yes === true),
                );

                return (
                  <div
                    key={`${match.id ?? resume?.id ?? "resume"}-${index}`}
                    style={{
                      border: isMutualMatch ? "2px solid #22c55e" : "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px",
                      background: isMutualMatch ? "#f0fdf4" : "#f8fafc",
                      transition: "all 0.2s ease-in-out",
                      boxShadow: isMutualMatch ? "0 4px 12px rgba(34, 197, 94, 0.12)" : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#0f172a" }}>
                        {formatApplicantName(resume)}
                      </h2>
                      {isMutualMatch ? (
                        <span
                          style={{
                            borderRadius: "20px",
                            background: "#16a34a",
                            color: "#ffffff",
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Matched
                        </span>
                      ) : (
                        <span
                          style={{
                            borderRadius: "20px",
                            background: "#e2e8f0",
                            color: "#475569",
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Interested
                        </span>
                      )}
                    </div>

                    {resume?.owner_email && (
                      <p style={{ margin: "0 0 6px", color: "#475569", fontWeight: 600 }}>
                        {resume.owner_email}
                      </p>
                    )}

                    {resume?.summary && (
                      <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.5, fontSize: "0.95rem" }}>
                        {resume.summary}
                      </p>
                    )}

                    {Array.isArray(resume?.skills) && resume.skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                        {resume.skills.map((skill) => (
                          <span
                            key={skill}
                            style={{
                              borderRadius: "6px",
                              background: "#e2e8f0",
                              color: "#334155",
                              padding: "4px 8px",
                              fontSize: "0.85rem",
                              fontWeight: 500,
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {Array.isArray(resume?.experiences) && resume.experiences.length > 0 && (
                      <div style={{ marginTop: "12px", color: "#475569", fontSize: "0.95rem" }}>
                        <strong style={{ color: "#334155" }}>Experience</strong>
                        {resume.experiences.slice(0, 2).map((experience, experienceIndex) => (
                          <p
                            key={`${experience.title}-${experience.company}-${experienceIndex}`}
                            style={{ margin: "6px 0 0", lineHeight: 1.45 }}
                          >
                            {experience.title || "Role"} at {experience.company || "Company"}
                            {experience.type ? ` · ${formatJobType(experience.type)}` : ""}
                          </p>
                        ))}
                      </div>
                    )}

                    {Array.isArray(resume?.education) && resume.education.length > 0 && (
                      <div style={{ marginTop: "12px", color: "#475569", fontSize: "0.95rem" }}>
                        <strong style={{ color: "#334155" }}>Education</strong>
                        {resume.education.slice(0, 2).map((education, educationIndex) => (
                          <p
                            key={`${education.school}-${educationIndex}`}
                            style={{ margin: "6px 0 0", lineHeight: 1.45 }}
                          >
                            {[education.degree, education.degree_type, education.school]
                              .filter(Boolean)
                              .join(" · ") || "Education listed"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div
    style={{
      border: "1px dashed #cbd5e1",
      borderRadius: "14px",
      padding: "32px 20px",
      textAlign: "center",
      background: "#f8fafc",
    }}
  >
    <p style={{ margin: 0, fontSize: "1.1rem", color: "#475569" }}>{text}</p>
  </div>
);

const formatApplicantName = (resume?: ApplicantResume) =>
  [resume?.owner_first_name, resume?.owner_last_name].filter(Boolean).join(" ") || "Applicant";

const formatJobType = (type?: string) => {
  if (!type) {
    return "Not listed";
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

export default CompanyInterested;
