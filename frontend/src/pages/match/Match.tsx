import "./Match.css";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import MatchJob from "./MatchJob.js";
import MatchResume from "./MatchResume.js";
import SideMenu from "../Menu.js";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";
import { ApplicantUser, CompanyUser, Job } from "shared";

type ProposedMatch =
  | {
      type: "applicant";
      applicant: ApplicantUser;
    }
  | {
      type: "job";
      job: Job;
      company: CompanyUser;
    };

const Match = () => {
  const { user, auth } = useUserInfo();
  const [queue, setQueue] = useState<ProposedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);
  
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job_id");
  const isCompany = user && 'companyName' in user;

  const showMatchError = (message: string) => {
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

  // Wrap fetch logic in useCallback so it can be called whenever we run out of cards
  const fetchMatches = useCallback(async () => {
    try {
      if (!auth) return;

      let endpoint = "";
      if (isCompany) {
        if (!jobId) throw new Error("Missing job_id in URL");
        endpoint = `http://127.0.0.1:8000/api/matching/resumes/?job_id=${jobId}`;
      } else {
        endpoint = `http://127.0.0.1:8000/api/matching/jobs/`;
      }

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${auth}`,
        },
      });

      if (response.status === 404) {
        setQueue([]);
        setLoading(false);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setQueue([]);
        showMatchError(getMatchErrorMessage(errorData, "Unable to load matches right now. Please try again."));
        return;
      }
      
      const data = await response.json();

      let formattedMatches: ProposedMatch[] = [];
      
      if (isCompany) {
        formattedMatches = data.map((djangoResume: any) => ({
          type: "applicant",
          applicant: {
            firstName: djangoResume.owner_first_name || "Applicant",
            lastName: djangoResume.owner_last_name || "",
            resume: {
              id: djangoResume.id,
              personalSummary: djangoResume.summary,
              skills: djangoResume.skills || [],
              experiences: djangoResume.experiences || [],
              education: djangoResume.education || [],
            }
          }
        }));
      } else {
        formattedMatches = data.map((djangoJob: any) => ({
          type: "job",
          job: {
            id: djangoJob.id,
            jobTitle: djangoJob.title,
            location: djangoJob.location,
            payPerYear: parseFloat(djangoJob.pay),
            type: djangoJob.type,
            description: djangoJob.description,
            skillsNeeded: djangoJob.skills || [],
          },
          company: { 
            companyName: djangoJob.company_name || "Company"
          }
        }));
      }

      setQueue(formattedMatches);
    } catch (error) {
      console.error(error);
      showMatchError("Unable to load matches right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [auth, jobId, isCompany]);

  useEffect(() => {
    if (user && auth) {
      fetchMatches();
    }
  }, [user, auth, fetchMatches]);

  // Handle the swipe action when clicking X (false) or Check (true)
  const handleSwipe = async (isInterested: boolean) => {
    const currentMatch = queue[0];
    if (!currentMatch) return;

    let targetJobId: number | null = null;
    let targetResumeId: number | null = null;

    if (isCompany) {
      targetJobId = jobId ? parseInt(jobId, 10) : null;
      targetResumeId = currentMatch.type === "applicant" ? currentMatch.applicant.resume?.id ?? null : null;
    } else {
      targetJobId = currentMatch.type === "job" ? (currentMatch.job as any).id ?? null : null;
    }

    if (!targetJobId || (isCompany && !targetResumeId)) {
      console.error("Missing required IDs for swipe request.", { targetJobId, targetResumeId });
      showMatchError("Unable to save that swipe because the match data is incomplete.");
      return;
    }

    // 1. Optimistically remove the top card to instantly advance the UI queue
    setQueue((prevQueue) => {
      const updatedQueue = prevQueue.slice(1);
      
      // If the queue just became empty, trigger a background refetch for more matches!
      if (updatedQueue.length === 0) {
        setLoading(true);
        fetchMatches();
      }
      
      return updatedQueue;
    });

    try {
      const payload: any = {
        job_id: targetJobId,
        is_interested: isInterested,
      };

      if (isCompany) {
        payload.resume_id = targetResumeId;
      }

      const response = await fetch(`http://127.0.0.1:8000/api/swipe/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${auth}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        showMatchError(getMatchErrorMessage(errorData, "Unable to save that swipe right now. Please try again."));
        return;
      }

      const data = await response.json();

      if (data.is_mutual_match) {
        alert("It's a Mutual Match! 🎉");
      }
    } catch (error) {
      console.error("Error processing swipe:", error);
      showMatchError("Unable to save that swipe right now. Please try again.");
    }
  };

  const errorToast = showErrorToast && (
    <div style={toastStyle} role="alert" aria-live="assertive">
      <div style={toastHeaderStyle}>
        <strong>Match error</strong>
        <button
          type="button"
          onClick={() => setShowErrorToast(false)}
          style={toastCloseButtonStyle}
          aria-label="Dismiss match error"
        >
          ×
        </button>
      </div>
      <p style={toastMessageStyle}>{errorMessage}</p>
    </div>
  );

  if (loading) {
    return (
      <>
        {errorToast}
        <div>Loading your best matches...</div>
      </>
    );
  }

  const currentMatch = queue[0];
  if (!currentMatch) {
    return (
      <>
        {errorToast}
        <div>No more matches available right now!</div>
      </>
    );
  }

  const menuType = isCompany ? "company" : "applicant";

  return (
    <>
      {errorToast}
      <SideMenu userType={menuType} />
      <div className="match-container">
        <div className="match-content">
          {currentMatch.type === "applicant" && (
            <MatchResume applicant={currentMatch.applicant} />
          )}

          {currentMatch.type === "job" && (
            <MatchJob job={currentMatch.job} company={currentMatch.company} />
          )}
        </div>
        <div className="match-buttons">
          <button 
            onClick={() => handleSwipe(false)} 
            className="match-button reject-button"
          >
            X
          </button>
          <button 
            onClick={() => handleSwipe(true)} 
            className="match-button accept-button"
          >
            ✓
          </button>
        </div>
      </div>
    </>
  );
};

const getMatchErrorMessage = (data: unknown, fallbackMessage: string) => {
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

export default Match;
