<<<<<<< HEAD
import { useEffect, useState } from "react";
=======
import { useState, useEffect, useCallback } from "react";
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
import { useNavigate } from "react-router-dom";
import SideMenu from "../Menu.js";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";

<<<<<<< HEAD
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
=======
type JobData = {
  id: number;
  title: string;
  company?: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    email?: string;
  };
  location: string;
  pay: string | number;
  type: string;
  description: string;
  skills: string[];
};

type MatchItem = {
  id: number;
  job: JobData;
  applicant_swiped_yes: boolean | null;
  employer_swiped_yes: boolean | null;
  is_mutual_match: boolean;
  created_at: string;
};

type SuggestionsState = {
  [jobId: number]: {
    loading: boolean;
    suggestions: string[];
    companyName: string;
    jobTitle: string;
    companyEmail?: string | null;
    error?: string;
    draftText?: string;
    copied?: boolean;
    isOpen: boolean;
  };
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
};

const Interested = () => {
  const navigate = useNavigate();
<<<<<<< HEAD
  const { auth } = useUserInfo();
  const [interestedJobs, setInterestedJobs] = useState<InterestedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);

  const showInterestedError = (message: string) => {
    setErrorMessage(message);
=======
  const { user, auth } = useUserInfo();

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<number, boolean>>({});
  const [suggestionsMap, setSuggestionsMap] = useState<SuggestionsState>({});

  const showToast = (msg: string) => {
    setErrorMessage(msg);
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
    setShowErrorToast(true);
  };

  useEffect(() => {
<<<<<<< HEAD
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
=======
    if (!showErrorToast) return;
    const timer = window.setTimeout(() => {
      setShowErrorToast(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [showErrorToast]);

  const fetchInterestedJobs = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/matches/applicant/", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${auth}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        showToast(errData?.detail || errData?.error || "Failed to load interested jobs.");
        setMatches([]);
        return;
      }

      const data = await response.json();
      setMatches(data);
    } catch (err) {
      console.error("Error fetching interested jobs:", err);
      showToast("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (user && auth) {
      fetchInterestedJobs();
    }
  }, [user, auth, fetchInterestedJobs]);

  const toggleDescription = (jobId: number) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  };

  const handleFetchSuggestions = async (job: JobData, matchId?: number) => {
    const current = suggestionsMap[job.id];
    
    // If already open and has suggestions, toggle collapse
    if (current && current.isOpen && !current.loading) {
      setSuggestionsMap((prev) => ({
        ...prev,
        [job.id]: { ...prev[job.id], isOpen: false },
      }));
      return;
    }

    // Set loading & open
    setSuggestionsMap((prev) => ({
      ...prev,
      [job.id]: {
        loading: true,
        suggestions: current?.suggestions || [],
        companyName: current?.companyName || job.company?.company_name || job.company?.username || "Company",
        jobTitle: current?.jobTitle || job.title,
        companyEmail: current?.companyEmail || job.company?.email,
        draftText: current?.draftText || "",
        copied: false,
        isOpen: true,
      },
    }));

    try {
      const response = await fetch("http://127.0.0.1:8000/api/matches/draft-suggestions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${auth}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          match_id: matchId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errDetail = errData?.error || errData?.detail || "Failed to generate suggestions.";
        setSuggestionsMap((prev) => ({
          ...prev,
          [job.id]: {
            ...prev[job.id],
            loading: false,
            error: errDetail,
            isOpen: true,
          },
        }));
        showToast(errDetail);
        return;
      }

      const data = await response.json();
      const compName = data.company_name || job.company?.company_name || job.company?.username || "the hiring team";
      
      // Starter template for the draft email
      const starterDraft = `Hi ${compName} Team,\n\nI was excited to match with your ${job.title} role! Based on my background and your team's goals, I would love to connect about how my skills align with what you're looking for.\n\nBest regards,\n${user?.firstName || "Applicant"}`;

      setSuggestionsMap((prev) => ({
        ...prev,
        [job.id]: {
          loading: false,
          suggestions: data.suggestions || [],
          companyName: compName,
          jobTitle: data.job_title || job.title,
          companyEmail: data.company_email || job.company?.email,
          draftText: prev[job.id]?.draftText || starterDraft,
          copied: false,
          isOpen: true,
        },
      }));
    } catch (err) {
      console.error("Error generating suggestions:", err);
      setSuggestionsMap((prev) => ({
        ...prev,
        [job.id]: {
          ...prev[job.id],
          loading: false,
          error: "Could not generate email suggestions at this time.",
          isOpen: true,
        },
      }));
      showToast("Unable to generate suggestions. Please try again.");
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
    const draft = suggestionsMap[jobId]?.draftText || "";
    navigator.clipboard.writeText(draft);
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

  const formatPay = (pay: string | number) => {
    const num = typeof pay === "string" ? parseFloat(pay) : pay;
    return isNaN(num) ? pay : `$${num.toLocaleString()} / year`;
  };
>>>>>>> f0cf308 (Added insterested jobs and draft message button)

  return (
    <>
      <SideMenu userType="applicant" />
<<<<<<< HEAD
      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Interested jobs error</strong>
=======

      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Notification</strong>
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
            <button
              type="button"
              onClick={() => setShowErrorToast(false)}
              style={toastCloseButtonStyle}
<<<<<<< HEAD
              aria-label="Dismiss interested jobs error"
=======
              aria-label="Dismiss notification"
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
            >
              ×
            </button>
          </div>
          <p style={toastMessageStyle}>{errorMessage}</p>
        </div>
      )}
<<<<<<< HEAD
=======

>>>>>>> f0cf308 (Added insterested jobs and draft message button)
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

<<<<<<< HEAD
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
=======
          {/* Loading state */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
              <div
                style={{
                  display: "inline-block",
                  width: "36px",
                  height: "36px",
                  border: "4px solid #e2e8f0",
                  borderTopColor: "#2563eb",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  marginBottom: "12px",
                }}
              />
              <p style={{ margin: 0, fontSize: "1.05rem" }}>Loading your saved jobs...</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : matches.length === 0 ? (
            /* Empty state */
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
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
<<<<<<< HEAD
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
=======
            /* Job List */
            <div style={{ display: "grid", gap: "20px" }}>
              {matches.map((item) => {
                const job = item.job;
                const companyName = job.company?.company_name || job.company?.first_name || job.company?.username || "Hiring Company";
                const isMatched = item.is_mutual_match || (item.applicant_swiped_yes && item.employer_swiped_yes);
                const isExpanded = !!expandedDescriptions[job.id];
                const suggestionInfo = suggestionsMap[job.id];
                const isSuggestionsOpen = suggestionInfo?.isOpen;

                return (
                  <div
                    key={`job-${job.id}-${item.id}`}
                    style={{
                      border: isMatched ? "2px solid #86efac" : "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "24px",
                      background: isMatched ? "#f0fdf4" : "#ffffff",
                      boxShadow: isMatched
                        ? "0 4px 16px rgba(34, 197, 94, 0.12)"
                        : "0 2px 8px rgba(15, 23, 42, 0.04)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {/* Header Row */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "1.35rem",
                            color: "#0f172a",
                            fontWeight: 700,
                          }}
                        >
                          {job.title}
                        </h2>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginTop: "4px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#2563eb", fontSize: "1.05rem" }}>
                            {companyName}
                          </span>
                          {job.company?.email && (
                            <span style={{ color: "#64748b", fontSize: "0.88rem" }}>
                              • {job.company.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {isMatched ? (
                          <span
                            style={{
                              background: "#22c55e",
                              color: "#ffffff",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: "9999px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              boxShadow: "0 2px 6px rgba(34, 197, 94, 0.3)",
                            }}
                          >
                            🎉 Mutual Match!
                          </span>
                        ) : (
                          <span
                            style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              padding: "4px 12px",
                              borderRadius: "9999px",
                            }}
                          >
                            ⏳ Pending Employer Review
                          </span>
                        )}

                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#475569",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: "9999px",
                            textTransform: "capitalize",
                          }}
                        >
                          {job.type ? job.type.replace("_", " ") : "Full-time"}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Row */}
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        color: "#475569",
                        fontSize: "0.95rem",
                        marginBottom: "14px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>📍</span> {job.location || "Remote / Not specified"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>💰</span> {formatPay(job.pay)}
                      </div>
                    </div>

                    {/* Skills Chips */}
                    {job.skills && job.skills.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          marginBottom: "14px",
                        }}
                      >
                        {job.skills.map((skill, sIdx) => (
                          <span
                            key={`skill-${sIdx}`}
                            style={{
                              background: "#f1f5f9",
                              color: "#334155",
                              fontSize: "0.82rem",
                              fontWeight: 500,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {job.description && (
                      <div style={{ marginBottom: "16px" }}>
                        <p
                          style={{
                            margin: 0,
                            color: "#334155",
                            fontSize: "0.95rem",
                            lineHeight: 1.5,
                            whiteSpace: "pre-line",
                          }}
                        >
                          {isExpanded || job.description.length <= 220
                            ? job.description
                            : `${job.description.slice(0, 220)}...`}
                        </p>
                        {job.description.length > 220 && (
                          <button
                            type="button"
                            onClick={() => toggleDescription(job.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#2563eb",
                              cursor: "pointer",
                              padding: 0,
                              marginTop: "4px",
                              fontSize: "0.88rem",
                              fontWeight: 600,
                            }}
                          >
                            {isExpanded ? "Show less" : "Read full description"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "14px",
                        borderTop: "1px solid #e2e8f0",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                        Saved on {new Date(item.created_at).toLocaleDateString()}
                      </div>

                      {/* DRAFT EMAIL BUTTON - IN THE BOX OF THE MATCHED JOB */}
                      <button
                        type="button"
                        onClick={() => handleFetchSuggestions(job, item.id)}
                        style={{
                          border: "none",
                          borderRadius: "8px",
                          background: isSuggestionsOpen ? "#4338ca" : "#4f46e5",
                          color: "#ffffff",
                          padding: "10px 18px",
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSuggestionsOpen) e.currentTarget.style.background = "#4338ca";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSuggestionsOpen) e.currentTarget.style.background = "#4f46e5";
                        }}
                      >
                        <span>✉️</span>
                        {suggestionInfo?.loading
                          ? "Generating talking points..."
                          : isSuggestionsOpen
                          ? "Hide Email Suggestions"
                          : "Draft Email"}
                      </button>
                    </div>

                    {/* AI DRAFT EMAIL SUGGESTIONS SECTION */}
                    {isSuggestionsOpen && (
                      <div
                        style={{
                          marginTop: "18px",
                          padding: "20px",
                          borderRadius: "12px",
                          background: "#f5f3ff",
                          border: "1px solid #ddd6fe",
                          animation: "fadeIn 0.2s ease-in-out",
                        }}
                      >
                        {suggestionInfo?.loading ? (
                          <div style={{ textAlign: "center", padding: "20px", color: "#6b21a8" }}>
                            <div
                              style={{
                                display: "inline-block",
                                width: "28px",
                                height: "28px",
                                border: "3px solid #ddd6fe",
                                borderTopColor: "#7c3aed",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite",
                                marginBottom: "8px",
                              }}
                            />
                            <p style={{ margin: 0, fontWeight: 500, fontSize: "0.95rem" }}>
                              Claude is analyzing your resume & job requirements to generate talking points...
                            </p>
                          </div>
                        ) : suggestionInfo?.error ? (
                          <div style={{ color: "#b91c1c", fontSize: "0.95rem" }}>
                            <p style={{ margin: "0 0 10px", fontWeight: 600 }}>
                              ⚠️ Could not generate suggestions: {suggestionInfo.error}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleFetchSuggestions(job, item.id)}
                              style={{
                                background: "#7c3aed",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "6px",
                                padding: "6px 12px",
                                cursor: "pointer",
                                fontSize: "0.88rem",
                              }}
                            >
                              Try again
                            </button>
                          </div>
                        ) : (
                          <div>
                            {/* Suggestions List */}
                            <div style={{ marginBottom: "18px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  marginBottom: "10px",
                                }}
                              >
                                <span style={{ fontSize: "1.25rem" }}>💡</span>
                                <h3
                                  style={{
                                    margin: 0,
                                    fontSize: "1.1rem",
                                    color: "#5b21b6",
                                    fontWeight: 700,
                                  }}
                                >
                                  What to say to {companyName}:
                                </h3>
                              </div>
                              <p style={{ margin: "0 0 12px", color: "#6b21a8", fontSize: "0.9rem" }}>
                                Use these personalized suggestions tailored from your background to craft your message:
                              </p>

                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: "20px",
                                  display: "grid",
                                  gap: "8px",
                                }}
                              >
                                {suggestionInfo?.suggestions?.map((itemText, i) => (
                                  <li
                                    key={`sug-${i}`}
                                    style={{
                                      color: "#2e1065",
                                      fontSize: "0.93rem",
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {itemText}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Scratchpad / Draft Editor */}
                            <div
                              style={{
                                background: "#ffffff",
                                borderRadius: "10px",
                                padding: "16px",
                                border: "1px solid #c4b5fd",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "8px",
                                }}
                              >
                                <label
                                  htmlFor={`draft-${job.id}`}
                                  style={{
                                    fontSize: "0.92rem",
                                    fontWeight: 700,
                                    color: "#374151",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  ✍️ Your Email Draft
                                </label>
                                {job.company?.email && (
                                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                                    To: {job.company.email}
                                  </span>
                                )}
                              </div>

                              <textarea
                                id={`draft-${job.id}`}
                                rows={6}
                                value={suggestionInfo?.draftText || ""}
                                onChange={(e) => handleUpdateDraft(job.id, e.target.value)}
                                placeholder="Type or customize your email message here using the suggestions above..."
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  borderRadius: "8px",
                                  border: "1px solid #d1d5db",
                                  padding: "10px 12px",
                                  fontFamily: "inherit",
                                  fontSize: "0.92rem",
                                  lineHeight: 1.45,
                                  color: "#111827",
                                  resize: "vertical",
                                }}
                              />

                              {/* Scratchpad Action Buttons */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: "10px",
                                  marginTop: "12px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {job.company?.email && (
                                  <a
                                    href={`mailto:${job.company.email}?subject=${encodeURIComponent(
                                      `Application for ${job.title} - ${user?.firstName || "Applicant"}`
                                    )}&body=${encodeURIComponent(suggestionInfo?.draftText || "")}`}
                                    style={{
                                      textDecoration: "none",
                                      background: "#f3f4f6",
                                      color: "#374151",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "6px",
                                      padding: "8px 14px",
                                      fontWeight: 600,
                                      fontSize: "0.88rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    📤 Open Email App
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleCopyEmail(job.id)}
                                  style={{
                                    border: "none",
                                    borderRadius: "6px",
                                    background: suggestionInfo?.copied ? "#16a34a" : "#2563eb",
                                    color: "#ffffff",
                                    padding: "8px 16px",
                                    fontWeight: 600,
                                    fontSize: "0.88rem",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    transition: "background 0.2s ease",
                                  }}
                                >
                                  {suggestionInfo?.copied ? "✓ Copied to clipboard!" : "📋 Copy email text"}
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
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
            </div>
          )}
        </div>
      </div>
    </>
  );
};

<<<<<<< HEAD
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

=======
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
const toastStyle: React.CSSProperties = {
  position: "fixed",
  top: "24px",
  right: "24px",
  zIndex: 1000,
<<<<<<< HEAD
  width: "min(360px, calc(100vw - 32px))",
=======
  width: "min(380px, calc(100vw - 32px))",
>>>>>>> f0cf308 (Added insterested jobs and draft message button)
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
