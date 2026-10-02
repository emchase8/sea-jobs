import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SideMenu from "../Menu.js";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";

type ApplicantMatch = {
  id?: number;
  job?: InterestedJob;
  applicant_swiped_yes?: boolean | null;
  employer_swiped_yes?: boolean | null;
  is_mutual_match?: boolean;
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

type SuggestionsState = {
  [jobId: number]: {
    loading: boolean;
    suggestions: string[];
    companyName: string;
    draftText?: string;
    copied?: boolean;
    error?: string;
    isOpen: boolean;
  };
};

const Interested = () => {
  const navigate = useNavigate();
  const { user, auth } = useUserInfo();
  const [interestedJobs, setInterestedJobs] = useState<InterestedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [suggestionsMap, setSuggestionsMap] = useState<SuggestionsState>({});

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
        setInterestedJobs(
          matches
            .map((match: ApplicantMatch) => match.job)
            .filter((job): job is InterestedJob => Boolean(job)),
        );
      } catch {
        setInterestedJobs([]);
        showInterestedError("Unable to load interested jobs right now. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInterestedJobs();
  }, [auth]);

  const handleToggleDraftEmail = async (job: InterestedJob) => {
    if (!job.id) return;

    const current = suggestionsMap[job.id];

    if (current && current.isOpen) {
      setSuggestionsMap((prev) => ({
        ...prev,
        [job.id!]: { ...prev[job.id!], isOpen: false },
      }));
      return;
    }

    const companyName = formatCompanyName(job.company);

    setSuggestionsMap((prev) => ({
      ...prev,
      [job.id!]: {
        loading: true,
        suggestions: current?.suggestions || [],
        companyName,
        draftText: current?.draftText || "",
        copied: false,
        isOpen: true,
      },
    }));

    try {
      const response = await fetch("http://localhost:8000/api/matches/draft-suggestions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${auth}`,
        },
        body: JSON.stringify({
          job_id: job.id,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errDetail = data?.error || data?.detail || "Failed to generate suggestions.";
        setSuggestionsMap((prev) => ({
          ...prev,
          [job.id!]: {
            ...prev[job.id!],
            loading: false,
            error: errDetail,
            isOpen: true,
          },
        }));
        showInterestedError(errDetail);
        return;
      }

      const defaultDraft = `Hi ${companyName} Team,\n\nI was excited to connect regarding the ${job.title || "open"} role. Based on my background and your team's goals, I would welcome the opportunity to discuss how my skills align with what you're looking for.\n\nBest regards,\n${user?.firstName || "Applicant"}`;

      setSuggestionsMap((prev) => ({
        ...prev,
        [job.id!]: {
          loading: false,
          suggestions: data.suggestions || [],
          companyName,
          draftText: prev[job.id!]?.draftText || defaultDraft,
          copied: false,
          isOpen: true,
        },
      }));
    } catch {
      setSuggestionsMap((prev) => ({
        ...prev,
        [job.id!]: {
          ...prev[job.id!],
          loading: false,
          error: "Could not generate email suggestions at this time.",
          isOpen: true,
        },
      }));
      showInterestedError("Unable to generate suggestions right now. Please try again.");
    }
  };

  const handleUpdateDraft = (jobId: number, text: string) => {
    setSuggestionsMap((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        draftText: text,
        copied: false,
      },
    }));
  };

  const handleCopyEmail = (jobId: number) => {
    const text = suggestionsMap[jobId]?.draftText || "";
    navigator.clipboard.writeText(text);
    setSuggestionsMap((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        copied: true,
      },
    }));
    setTimeout(() => {
      setSuggestionsMap((prev) => ({
        ...prev,
        [jobId]: {
          ...prev[jobId],
          copied: false,
        },
      }));
    }, 2500);
  };

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
                Your interested jobs
              </h1>
              <p style={{ margin: "8px 0 0", color: "#475569" }}>
                Jobs you have marked as interested.
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
                padding: "12px 18px",
                fontWeight: 600,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Find jobs
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
                border: "1px dashed #cbd5e1",
                borderRadius: "14px",
                padding: "32px 20px",
                textAlign: "center",
                background: "#f8fafc",
              }}
            >
              <p style={{ margin: 0, fontSize: "1.1rem", color: "#475569" }}>
                You have not saved any jobs yet.
              </p>
              <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                Click “Find jobs” to look through matches.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {interestedJobs.map((job, index) => {
                const suggestion = job.id ? suggestionsMap[job.id] : undefined;
                const isSuggestionOpen = !!suggestion?.isOpen;

                return (
                  <div
                    key={`${job.id ?? job.title ?? "job"}-${index}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px",
                      background: "#f8fafc",
                    }}
                  >
                    <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#0f172a" }}>
                      {job.title || "Untitled job"}
                    </h2>
                    <p style={{ margin: "0 0 6px", color: "#475569", fontWeight: 600 }}>
                      {formatCompanyName(job.company)}
                    </p>
                    <p style={{ margin: "0 0 6px", color: "#475569" }}>
                      {job.location} · {formatJobType(job.type)}
                    </p>
                    <p style={{ margin: 0, color: "#475569" }}>
                      {formatPay(job.pay)}
                    </p>

                    {job.description && (
                      <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.5, fontSize: "0.95rem" }}>
                        {job.description}
                      </p>
                    )}

                    {Array.isArray(job.skills) && job.skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                        {job.skills.map((skill) => (
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

                    <div style={{ marginTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleDraftEmail(job)}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          color: "#2563eb",
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          cursor: "pointer",
                          textDecoration: "none",
                        }}
                      >
                        {isSuggestionOpen ? "Hide email suggestions" : "Draft email"}
                      </button>
                    </div>

                    {isSuggestionOpen && (
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "16px",
                          borderRadius: "10px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        {suggestion?.loading ? (
                          <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>
                            Generating email suggestions...
                          </p>
                        ) : suggestion?.error ? (
                          <div>
                            <p style={{ margin: "0 0 8px", color: "#b91c1c", fontSize: "0.95rem" }}>
                              {suggestion.error}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleToggleDraftEmail(job)}
                              style={{
                                border: "none",
                                borderRadius: "6px",
                                background: "#2563eb",
                                color: "#ffffff",
                                padding: "6px 12px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                            >
                              Try again
                            </button>
                          </div>
                        ) : (
                          <div>
                            <h3
                              style={{
                                margin: "0 0 6px",
                                fontSize: "1rem",
                                color: "#0f172a",
                                fontWeight: 600,
                              }}
                            >
                              Suggestions for reaching out to {suggestion?.companyName || "the recruiter"}:
                            </h3>
                            <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: "0.88rem" }}>
                              Use these key talking points to guide your message:
                            </p>

                            <ul
                              style={{
                                margin: "0 0 14px",
                                paddingLeft: "20px",
                                display: "grid",
                                gap: "6px",
                                color: "#334155",
                                fontSize: "0.92rem",
                                lineHeight: 1.45,
                              }}
                            >
                              {suggestion?.suggestions?.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>

                            <div style={{ marginTop: "12px" }}>
                              <label
                                htmlFor={`draft-${job.id}`}
                                style={{
                                  display: "block",
                                  marginBottom: "6px",
                                  fontSize: "0.88rem",
                                  fontWeight: 600,
                                  color: "#334155",
                                }}
                              >
                                Email draft
                              </label>
                              <textarea
                                id={`draft-${job.id}`}
                                rows={5}
                                value={suggestion?.draftText || ""}
                                onChange={(e) => handleUpdateDraft(job.id!, e.target.value)}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  borderRadius: "8px",
                                  border: "1px solid #cbd5e1",
                                  padding: "10px",
                                  fontFamily: "inherit",
                                  fontSize: "0.92rem",
                                  lineHeight: 1.45,
                                  color: "#0f172a",
                                  resize: "vertical",
                                }}
                              />

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: "8px",
                                  marginTop: "10px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {job.company?.email && (
                                  <a
                                    href={`mailto:${job.company.email}?subject=${encodeURIComponent(
                                      `Application for ${job.title} - ${user?.firstName || "Applicant"}`,
                                    )}&body=${encodeURIComponent(suggestion?.draftText || "")}`}
                                    style={{
                                      textDecoration: "none",
                                      background: "#f1f5f9",
                                      color: "#334155",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "6px",
                                      padding: "6px 12px",
                                      fontWeight: 600,
                                      fontSize: "0.88rem",
                                      display: "inline-block",
                                    }}
                                  >
                                    Open mail client
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleCopyEmail(job.id!)}
                                  style={{
                                    border: "none",
                                    borderRadius: "6px",
                                    background: suggestion?.copied ? "#16a34a" : "#2563eb",
                                    color: "#ffffff",
                                    padding: "6px 14px",
                                    fontWeight: 600,
                                    fontSize: "0.88rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  {suggestion?.copied ? "Copied" : "Copy email text"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
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

const formatCompanyName = (company?: InterestedJob["company"]) =>
  [company?.first_name, company?.last_name].filter(Boolean).join(" ") ||
  company?.username ||
  "Company";

const formatPay = (pay?: string | number) => {
  if (pay === undefined || pay === null || pay === "") {
    return "Pay not listed";
  }

  const numericPay = Number(pay);

  if (Number.isNaN(numericPay)) {
    return String(pay);
  }

  return `$${numericPay.toLocaleString()} / year`;
};

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

export default Interested;
