import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SideMenu from "../Menu.js";
import { Job } from "shared";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";

type JobListing = Job & { id: number };

const formatJobType = (type: Job["type"]) =>
  type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const Jobs = () => {
  const navigate = useNavigate();
  const { user, auth } = useUserInfo();
  const [jobListings, setJobListings] = useState<JobListing[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);

  const showJobsError = (message: string) => {
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
    const fetchJobListings = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/job/", {
          method: "GET",
          headers: {
            Authorization: `Token ${auth}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json()
        if (response.ok) {
          const companyUserID =
            (user as { _userID?: number | null } | null)?._userID ?? null;
          const jobs: JobListing[] = data.map(
            (job: {
              id: number;
              title: string;
              jobTitle?: string;
              location: string;
              pay: number;
              payPerYear?: number;
              type: Job["type"];
              description: string;
              skills: string[];
              skillsNeeded?: string[];
            }) =>
              Object.assign(
                new Job(
                  job.title ?? job.jobTitle,
                  companyUserID,
                  job.location,
                  job.pay ?? job.payPerYear,
                  job.type,
                  job.description,
                  job.skills ?? job.skillsNeeded,
                ),
                { id: job.id },
              ),
          );
          setJobListings(jobs);
        } else {
          console.log(data);
          setJobListings([]);
          showJobsError(getJobsErrorMessage(data));
        }
      } catch {
        setJobListings([]);
        showJobsError("Unable to load job listings right now. Please try again.");
      }
    }

    fetchJobListings();
  }, [auth, user]);

  return (
    <>
      <SideMenu userType="company" />
      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Jobs error</strong>
            <button
              type="button"
              onClick={() => setShowErrorToast(false)}
              style={toastCloseButtonStyle}
              aria-label="Dismiss jobs error"
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
              Your job listings
            </h1>
            <p style={{ margin: "8px 0 0", color: "#475569" }}>
              Manage the jobs you have posted and find applicant matches!
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/company/job")}
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
            + Add job
          </button>
        </div>

        {jobListings.length === 0 ? (
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
              You have not created any job listings yet.
            </p>
            <p style={{ margin: "8px 0 0", color: "#64748b" }}>
              Click “Add job” to create your first listing.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {jobListings.map((job, index) => (
              <div
                key={`${job.jobTitle}-${index}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#f8fafc",
                }}
              >
                <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#0f172a" }}>
                  {job.jobTitle}
                </h2>
                <p style={{ margin: "0 0 6px", color: "#475569" }}>
                  {job.location} · {formatJobType(job.type)}
                </p>
                <p style={{ margin: 0, color: "#475569" }}>
                  ${job.payPerYear.toLocaleString()} / year
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "12px",
                  }}
                >
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <Link
                      to={`/company/match?job_id=${job.id}`}
                      style={{
                        color: "#2563eb",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      View matches
                    </Link>
                    <Link
                      to={`/company/interested?job_id=${job.id}`}
                      style={{
                        color: "#2563eb",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Interested applicants
                    </Link>
                  </div>
                  <Link
                    to={`/company/job/${job.id}/edit`}
                    style={{
                      color: "#2563eb",
                      fontWeight: 600,
                      textDecoration: "none",
                      marginLeft: "auto",
                    }}
                  >
                    Edit description
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

const getJobsErrorMessage = (data: unknown) => {
  if (!data || typeof data !== "object") {
    return "Unable to load job listings right now. Please try again.";
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

  return "Unable to load job listings right now. Please try again.";
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

export default Jobs;
