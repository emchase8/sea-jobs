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
  [id: number]: {
    loading: boolean;
    suggestions: string[];
    companyName?: string;
    draftText?: string;
    copied?: boolean;
    error?: string;
    isOpen: boolean;
  };
};

type InterestedJobMatch = {
  job: InterestedJob;
  isMutualMatch: boolean;
};

type NetworkConnectionItem = {
  id: number;
  peer_user: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  peer_resume: {
    id: number;
    summary?: string;
    skills?: string[];
  } | null;
  is_mutual_match: boolean;
};

// ... (rest unchanged until connections map)


const Interested = () => {
  const navigate = useNavigate();
  const { user, auth } = useUserInfo();

  const [activeTab, setActiveTab] = useState<"jobs" | "connections">("jobs");
  const [interestedItems, setInterestedItems] = useState<InterestedJobMatch[]>([]);
  const [networkConnections, setNetworkConnections] = useState<NetworkConnectionItem[]>([]);

  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingConnections, setLoadingConnections] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);

  const [jobSuggestionsMap, setJobSuggestionsMap] = useState<SuggestionsState>({});
  const [peerSuggestionsMap, setPeerSuggestionsMap] = useState<SuggestionsState>({});

  const showInterestedError = (message: string) => {
    setErrorMessage(message);
    setShowErrorToast(true);
  };

  useEffect(() => {
    if (!showErrorToast) return;
    const timeout = window.setTimeout(() => setShowErrorToast(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [showErrorToast]);

  useEffect(() => {
    if (!auth) {
      setLoadingJobs(false);
      return;
    }

    const fetchInterestedJobs = async () => {
      setLoadingJobs(true);
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
          setInterestedItems([]);
          showInterestedError(getInterestedErrorMessage(data, "Unable to load interested jobs."));
          return;
        }
        const matches = Array.isArray(data) ? data : [];
        setInterestedItems(
          matches
            .filter((match: ApplicantMatch) => Boolean(match.job))
            .map((match: ApplicantMatch) => ({
              job: match.job!,
              isMutualMatch: Boolean(
                match.is_mutual_match ||
                  (match.applicant_swiped_yes === true && match.employer_swiped_yes === true),
              ),
            })),
        );
      } catch {
        setInterestedItems([]);
        showInterestedError("Unable to load interested jobs right now.");
      } finally {
        setLoadingJobs(false);
      }
    };

    const fetchNetworkConnections = async () => {
      setLoadingConnections(true);
      try {
        const response = await fetch("http://localhost:8000/api/matches/network/", {
          method: "GET",
          headers: {
            Authorization: `Token ${auth}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json().catch(() => []);
        if (response.ok && Array.isArray(data)) {
          setNetworkConnections(data);
        }
      } catch {
        setNetworkConnections([]);
      } finally {
        setLoadingConnections(false);
      }
    };

    fetchInterestedJobs();
    fetchNetworkConnections();
  }, [auth]);

  const handleToggleJobDraft = async (job: InterestedJob) => {
    if (!job.id) return;
    const current = jobSuggestionsMap[job.id];
    if (current && current.isOpen) {
      setJobSuggestionsMap((prev) => ({
        ...prev,
        [job.id!]: { ...prev[job.id!], isOpen: false },
      }));
      return;
    }

    const companyName = formatCompanyName(job.company);
    setJobSuggestionsMap((prev) => ({
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
        body: JSON.stringify({ job_id: job.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errDetail = data?.error || data?.detail || "Failed to generate suggestions.";
        setJobSuggestionsMap((prev) => ({
          ...prev,
          [job.id!]: { ...prev[job.id!], loading: false, error: errDetail, isOpen: true },
        }));
        showInterestedError(errDetail);
        return;
      }
      const defaultDraft = `Hi ${companyName} Team,\n\nI was excited to connect regarding the ${job.title || "open"} role. Based on my background and your team's goals, I would welcome the opportunity to discuss how my skills align with what you're looking for.\n\nBest regards,\n${user?.firstName || "Applicant"}`;
      setJobSuggestionsMap((prev) => ({
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
      setJobSuggestionsMap((prev) => ({
        ...prev,
        [job.id!]: { ...prev[job.id!], loading: false, error: "Could not generate email suggestions.", isOpen: true },
      }));
      showInterestedError("Unable to generate suggestions right now.");
    }
  };

  const handleTogglePeerDraft = async (peerUserId: number) => {
    const current = peerSuggestionsMap[peerUserId];
    if (current && current.isOpen) {
      setPeerSuggestionsMap((prev) => ({
        ...prev,
        [peerUserId]: { ...prev[peerUserId], isOpen: false },
      }));
      return;
    }

    setPeerSuggestionsMap((prev) => ({
      ...prev,
      [peerUserId]: {
        loading: true,
        suggestions: current?.suggestions || [],
        draftText: current?.draftText || "",
        copied: false,
        isOpen: true,
      },
    }));

    try {
      const response = await fetch("http://localhost:8000/api/matches/draft-network-suggestions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${auth}`,
        },
        body: JSON.stringify({ peer_user_id: peerUserId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errDetail = data?.error || "Failed to generate suggestions.";
        setPeerSuggestionsMap((prev) => ({
          ...prev,
          [peerUserId]: { ...prev[peerUserId], loading: false, error: errDetail, isOpen: true },
        }));
        return;
      }

      setPeerSuggestionsMap((prev) => ({
        ...prev,
        [peerUserId]: {
          loading: false,
          suggestions: data.suggestions || [],
          draftText: data.draft_email || "",
          copied: false,
          isOpen: true,
        },
      }));
    } catch {
      setPeerSuggestionsMap((prev) => ({
        ...prev,
        [peerUserId]: { ...prev[peerUserId], loading: false, error: "Could not generate draft email.", isOpen: true },
      }));
    }
  };

  const handleCopyJobDraft = (jobId: number) => {
    const text = jobSuggestionsMap[jobId]?.draftText || "";
    navigator.clipboard.writeText(text);
    setJobSuggestionsMap((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], copied: true },
    }));
    setTimeout(() => {
      setJobSuggestionsMap((prev) => ({
        ...prev,
        [jobId]: { ...prev[jobId], copied: false },
      }));
    }, 2500);
  };

  const handleCopyPeerDraft = (peerUserId: number) => {
    const text = peerSuggestionsMap[peerUserId]?.draftText || "";
    navigator.clipboard.writeText(text);
    setPeerSuggestionsMap((prev) => ({
      ...prev,
      [peerUserId]: { ...prev[peerUserId], copied: true },
    }));
    setTimeout(() => {
      setPeerSuggestionsMap((prev) => ({
        ...prev,
        [peerUserId]: { ...prev[peerUserId], copied: false },
      }));
    }, 2500);
  };

  return (
    <>
      <SideMenu userType="applicant" />
      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Interested error</strong>
            <button
              type="button"
              onClick={() => setShowErrorToast(false)}
              style={toastCloseButtonStyle}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
          <p style={toastMessageStyle}>{errorMessage}</p>
        </div>
      )}
      <div style={{ minHeight: "100vh", padding: "24px 16px" }}>
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
                Interested & Connections
              </h1>
              <p style={{ margin: "8px 0 0", color: "#475569" }}>
                Jobs and networking peers you have connected with.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("jobs")}
                style={{
                  border: "none",
                  borderRadius: "8px",
                  background: activeTab === "jobs" ? "#ffffff" : "transparent",
                  color: activeTab === "jobs" ? "#16a34a" : "#64748b",
                  padding: "8px 16px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  boxShadow: activeTab === "jobs" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                }}
              >
                Jobs ({interestedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("connections")}
                style={{
                  border: "none",
                  borderRadius: "8px",
                  background: activeTab === "connections" ? "#ffffff" : "transparent",
                  color: activeTab === "connections" ? "#2563eb" : "#64748b",
                  padding: "8px 16px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  boxShadow: activeTab === "connections" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                }}
              >
                Networking Connections ({networkConnections.length})
              </button>
            </div>
          </div>

          {activeTab === "jobs" ? (
            loadingJobs ? (
              <div style={loadingCardStyle}>
                <p style={{ margin: 0, fontSize: "1.1rem", color: "#475569" }}>Loading interested jobs...</p>
              </div>
            ) : interestedItems.length === 0 ? (
              <div style={emptyCardStyle}>
                <p style={{ margin: 0, fontSize: "1.1rem", color: "#475569" }}>You have not saved any jobs yet.</p>
                <button
                  type="button"
                  onClick={() => navigate("/applicant/match")}
                  style={actionBtnStyle}
                >
                  Find jobs
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {[...interestedItems]
                  .sort((a, b) => (b.isMutualMatch ? 1 : 0) - (a.isMutualMatch ? 1 : 0))
                  .map(({ job, isMutualMatch }, index) => {
                  const suggestion = job.id ? jobSuggestionsMap[job.id] : undefined;
                  const isSuggestionOpen = !!suggestion?.isOpen;

                  return (
                    <div
                      key={`${job.id ?? job.title ?? "job"}-${index}`}
                      style={{
                        border: isMutualMatch ? "2px solid #22c55e" : "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px",
                        background: isMutualMatch ? "#f0fdf4" : "#f8fafc",
                        transition: "all 0.2s ease-in-out",
                        boxShadow: isMutualMatch ? "0 4px 12px rgba(34, 197, 94, 0.12)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                        <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#0f172a" }}>
                          {job.title || "Untitled job"}
                        </h2>
                        {isMutualMatch ? (
                          <span style={matchedBadgeStyle}>Matched</span>
                        ) : (
                          <span style={pendingBadgeStyle}>Pending recruiter</span>
                        )}
                      </div>
                      <p style={{ margin: "0 0 6px", color: "#475569", fontWeight: 600 }}>
                        {formatCompanyName(job.company)}
                      </p>
                      <p style={{ margin: "0 0 6px", color: "#475569" }}>
                        {job.location} · {formatJobType(job.type)}
                      </p>
                      <p style={{ margin: 0, color: "#475569" }}>{formatPay(job.pay)}</p>

                      {job.description && (
                        <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.5, fontSize: "0.95rem" }}>
                          {job.description}
                        </p>
                      )}

                      {isMutualMatch && (
                        <div style={{ marginTop: "12px" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleJobDraft(job)}
                            style={linkBtnStyle}
                          >
                            {isSuggestionOpen ? "Hide email suggestions" : "Draft email"}
                          </button>
                        </div>
                      )}

                      {isMutualMatch && isSuggestionOpen && (
                        <div style={draftBoxStyle}>
                          {suggestion?.loading ? (
                            <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>Generating email suggestions...</p>
                          ) : suggestion?.error ? (
                            <p style={{ margin: 0, color: "#b91c1c" }}>{suggestion.error}</p>
                          ) : (
                            <div>
                              <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0f172a", fontWeight: 600 }}>
                                Suggestions for reaching out to {suggestion?.companyName || "the recruiter"}:
                              </h3>
                              <ul style={{ margin: "0 0 14px", paddingLeft: "20px", display: "grid", gap: "6px", color: "#334155" }}>
                                {suggestion?.suggestions?.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                                Email draft
                              </label>
                              <textarea
                                rows={5}
                                value={suggestion?.draftText || ""}
                                onChange={(e) =>
                                  setJobSuggestionsMap((prev) => ({
                                    ...prev,
                                    [job.id!]: { ...prev[job.id!], draftText: e.target.value },
                                  }))
                                }
                                style={textareaStyle}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                                {job.company?.email && (
                                  <a
                                    href={`mailto:${job.company.email}?subject=${encodeURIComponent(`Application for ${job.title} - ${user?.firstName || "Applicant"}`)}&body=${encodeURIComponent(suggestion?.draftText || "")}`}
                                    style={secondaryLinkStyle}
                                  >
                                    Open mail client
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCopyJobDraft(job.id!)}
                                  style={{
                                    ...primaryBtnStyle,
                                    background: suggestion?.copied ? "#16a34a" : "#2563eb",
                                  }}
                                >
                                  {suggestion?.copied ? "Copied" : "Copy email text"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : loadingConnections ? (
            <div style={loadingCardStyle}>
              <p style={{ margin: 0, fontSize: "1.1rem", color: "#475569" }}>Loading networking connections...</p>
            </div>
          ) : networkConnections.length === 0 ? (
            <div style={emptyCardStyle}>
              <p style={{ margin: 0, fontSize: "1.1rem", color: "#475569" }}>No networking connections yet.</p>
              <button
                type="button"
                onClick={() => navigate("/applicant/network")}
                style={{ ...actionBtnStyle, background: "#2563eb" }}
              >
                Discover peers
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {[...networkConnections]
                .sort((a, b) => (b.is_mutual_match ? 1 : 0) - (a.is_mutual_match ? 1 : 0))
                .map((item) => {
                const peerUser = item.peer_user;
                const peerName = [peerUser.first_name, peerUser.last_name].filter(Boolean).join(" ") || peerUser.username;
                const peerDraft = peerSuggestionsMap[peerUser.id];
                const isPeerDraftOpen = Boolean(peerDraft?.isOpen);
                const isMutualMatch = Boolean(item.is_mutual_match);

                return (
                  <div
                    key={item.id}
                    style={{
                      border: isMutualMatch ? "2px solid #22c55e" : "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px",
                      background: isMutualMatch ? "#f0fdf4" : "#f8fafc",
                      transition: "all 0.2s ease-in-out",
                      boxShadow: isMutualMatch ? "0 4px 12px rgba(34, 197, 94, 0.12)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div>
                        <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", color: "#0f172a" }}>{peerName}</h2>
                        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>@{peerUser.username}</p>
                      </div>
                      {isMutualMatch ? (
                        <span style={matchedBadgeStyle}>Matched Connection</span>
                      ) : (
                        <span style={pendingBadgeStyle}>Pending peer</span>
                      )}
                    </div>

                    {item.peer_resume?.summary && (
                      <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.5, fontSize: "0.95rem" }}>
                        {item.peer_resume.summary}
                      </p>
                    )}

                    {isMutualMatch && (
                      <div style={{ marginTop: "12px" }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePeerDraft(peerUser.id)}
                          style={linkBtnStyle}
                        >
                          {isPeerDraftOpen ? "Hide email suggestions" : "Draft email"}
                        </button>
                      </div>
                    )}

                    {isPeerDraftOpen && (
                      <div style={draftBoxStyle}>
                        {peerDraft?.loading ? (
                          <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>Generating email draft...</p>
                        ) : peerDraft?.error ? (
                          <p style={{ margin: 0, color: "#b91c1c" }}>{peerDraft.error}</p>
                        ) : (
                          <div>
                            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0f172a", fontWeight: 600 }}>
                              Talking points for connecting with {peerName}:
                            </h3>
                            <ul style={{ margin: "0 0 14px", paddingLeft: "20px", display: "grid", gap: "6px", color: "#334155" }}>
                              {peerDraft?.suggestions?.map((point, i) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                              Networking Email Draft
                            </label>
                            <textarea
                              rows={5}
                              value={peerDraft?.draftText || ""}
                              onChange={(e) =>
                                setPeerSuggestionsMap((prev) => ({
                                  ...prev,
                                  [peerUser.id]: { ...prev[peerUser.id], draftText: e.target.value },
                                }))
                              }
                              style={textareaStyle}
                            />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                              {peerUser.email && (
                                <a
                                  href={`mailto:${peerUser.email}?subject=${encodeURIComponent(`Networking Connection - ${user?.firstName || "SeaJobs Applicant"}`)}&body=${encodeURIComponent(peerDraft?.draftText || "")}`}
                                  style={secondaryLinkStyle}
                                >
                                  Open mail client
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyPeerDraft(peerUser.id)}
                                style={{
                                  ...primaryBtnStyle,
                                  background: peerDraft?.copied ? "#16a34a" : "#2563eb",
                                }}
                              >
                                {peerDraft?.copied ? "Copied" : "Copy email text"}
                              </button>
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
  if (pay === undefined || pay === null || pay === "") return "Pay not listed";
  const numericPay = Number(pay);
  if (Number.isNaN(numericPay)) return String(pay);
  return `$${numericPay.toLocaleString()} / year`;
};

const formatJobType = (type?: string) => {
  if (!type) return "Not listed";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getInterestedErrorMessage = (data: unknown, fallbackMessage: string) => {
  if (!data || typeof data !== "object") return fallbackMessage;
  const errorData = data as Record<string, unknown>;
  const directMessage = errorData.detail || errorData.error || errorData.message;
  if (typeof directMessage === "string") return directMessage;
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

const loadingCardStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: "14px",
  padding: "32px 20px",
  textAlign: "center",
  background: "#f8fafc",
};

const emptyCardStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: "14px",
  padding: "32px 20px",
  textAlign: "center",
  background: "#f8fafc",
};

const actionBtnStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "10px",
  background: "#16a34a",
  color: "#ffffff",
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: "pointer",
  marginTop: "12px",
};

const matchedBadgeStyle: React.CSSProperties = {
  borderRadius: "20px",
  background: "#16a34a",
  color: "#ffffff",
  padding: "4px 10px",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const pendingBadgeStyle: React.CSSProperties = {
  borderRadius: "20px",
  background: "#e2e8f0",
  color: "#475569",
  padding: "4px 10px",
  fontSize: "0.75rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const linkBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#2563eb",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: "pointer",
};

const draftBoxStyle: React.CSSProperties = {
  marginTop: "14px",
  padding: "16px",
  borderRadius: "10px",
  background: "#ffffff",
  border: "1px solid #cbd5e1",
};

const textareaStyle: React.CSSProperties = {
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
};

const primaryBtnStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "6px",
  background: "#2563eb",
  color: "#ffffff",
  padding: "6px 14px",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
};

const secondaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  padding: "6px 12px",
  fontWeight: 600,
  fontSize: "0.88rem",
  display: "inline-block",
};

export default Interested;
