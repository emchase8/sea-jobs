import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Job, JobType } from "shared";
import SideMenu from "../Menu.js";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";

const JobPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const isEditing = Boolean(jobId);
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [payPerYear, setPayPerYear] = useState("");
  const [type, setType] = useState<JobType>(JobType.fullTime);
  const [description, setDescription] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [payError, setPayError] = useState("");
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const { auth } = useUserInfo()

  const showJobError = (message: string) => {
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
    if (!isEditing) {
      return;
    }

    const fetchJob = async () => {
      setIsLoadingJob(true);

      try {
        const response = await fetch(`http://localhost:8000/api/job/${jobId}/`, {
          method: "GET",
          headers: {
            Authorization: `Token ${auth}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();

        if (response.ok) {
          setJobTitle(data.title ?? "");
          setLocation(data.location ?? "");
          setPayPerYear(data.pay ? String(Number(data.pay)) : "");
          setType((data.type as JobType) ?? JobType.fullTime);
          setDescription(data.description ?? "");
          setSkills(Array.isArray(data.skills) ? data.skills : []);
        } else {
          showJobError(getJobErrorMessage(data, "Unable to load the job. Please try again."));
        }
      } catch {
        showJobError("Unable to load the job right now. Please try again.");
      } finally {
        setIsLoadingJob(false);
      }
    };

    fetchJob();
  }, [auth, isEditing, jobId]);

  const jobTypeLabels: Record<JobType, string> = {
    [JobType.fullTime]: "Full-time",
    [JobType.partTime]: "Part-time",
    [JobType.intern]: "Internship",
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();

    if (!trimmed || skills.includes(trimmed)) {
      setSkillInput("");
      return;
    }

    setSkills((previous) => [...previous, trimmed]);
    setSkillInput("");
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills((previous) =>
      previous.filter((skill) => skill !== skillToRemove),
    );
  };

  const extractSkills = async () => {
    if (!description) return;
    setIsExtracting(true);
    try {
      const response = await fetch("http://localhost:8000/api/job/extract-skills/", {
        method: "POST",
        headers: {
          Authorization: `Token ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      if (response.ok && data.skills) {
        setSkills((prev) => Array.from(new Set([...prev, ...data.skills])));
      } else {
        showJobError(data.error || "Failed to extract skills. Please try again.");
      }
    } catch {
      showJobError("Unable to extract skills right now. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    if (isEditing) {
      try {
        const response = await fetch(`http://localhost:8000/api/job/${jobId}/description/`, {
          method: "POST",
          headers: {
            Authorization: `Token ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description }),
        });
        const data = await response.json();

        if (response.ok) {
          navigate("/company/jobs");
        } else {
          showJobError(getJobErrorMessage(data, "Unable to update the job description. Please try again."));
        }
      } catch {
        showJobError("Unable to update the job description right now. Please try again.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const job = new Job(
      jobTitle,
      null,
      location,
      Number(payPerYear) || 0,
      type,
      description,
      skills,
    );

    try {
      const response = await fetch("http://localhost:8000/api/job/", {
        method: "POST",
        headers: {
          Authorization: `Token ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: job.jobTitle,
          location: job.location,
          pay: job.payPerYear,
          type: job.type,
          description: job.description,
          skills: job.skillsNeeded,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        console.log("Job data:", job);
        console.log(data);
        navigate("/company/jobs");
      } else {
        console.log("error")
        console.log(data);
        showJobError(getJobErrorMessage(data, "Unable to create the job. Please check the details and try again."));
      }
    } catch {
      showJobError("Unable to create the job right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SideMenu userType="company" />
      {showErrorToast && (
        <div style={toastStyle} role="alert" aria-live="assertive">
          <div style={toastHeaderStyle}>
            <strong>Job error</strong>
            <button
              type="button"
              onClick={() => setShowErrorToast(false)}
              style={toastCloseButtonStyle}
              aria-label="Dismiss job error"
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
          padding: "10px",
        }}
      >
        <div
          style={{
            maxWidth: "760px",
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: "10px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
            padding: "20px",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "2rem" }}>
            {isEditing ? "Edit job description" : "Create a job listing"}
          </h1>
          <p style={{ margin: "0 0 24px", color: "#475569" }}>
            {isEditing
              ? "Update the description applicants see for this job."
              : "Add the job details and required skills."}
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: "18px" }}
          >
            <div style={fieldStyle}>
              <label htmlFor="jobTitle" style={labelStyle}>
                Job title
              </label>
              <input
                id="jobTitle"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Senior Frontend Engineer"
                required
                disabled={isEditing || isLoadingJob}
                style={isEditing ? disabledInputStyle : inputStyle}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
              }}
            >
              <div style={fieldStyle}>
                <label htmlFor="location" style={labelStyle}>
                  Location
                </label>
                <input
                  id="location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Austin, TX"
                  required
                  disabled={isEditing || isLoadingJob}
                  style={isEditing ? disabledInputStyle : inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="payPerYear" style={labelStyle}>
                  Pay per year
                </label>
                <input
                  id="payPerYear"
                  type="number"
                  value={payPerYear}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val.replace(/\D/g, "").length > 10) {
                      setPayError("Pay cannot exceed 10 digits.");
                      return;
                    }
                    setPayError("");
                    setPayPerYear(val);
                  }}
                  placeholder="120000"
                  required
                  disabled={isEditing || isLoadingJob}
                  style={{
                    ...(isEditing ? disabledInputStyle : inputStyle),
                    borderColor: payError ? "#dc2626" : "#cbd5e1",
                  }}
                />
                {payError && (
                  <p style={{ margin: 0, color: "#dc2626", fontSize: "0.875rem" }}>
                    {payError}
                  </p>
                )}
              </div>
            </div>

            <div style={fieldStyle}>
              <label htmlFor="type" style={labelStyle}>
                Job type
              </label>
              <select
                id="type"
                value={type}
                onChange={(event) => setType(event.target.value as JobType)}
                disabled={isEditing || isLoadingJob}
                style={isEditing ? disabledInputStyle : inputStyle}
              >
                {Object.values(JobType).map((jobType) => (
                  <option key={jobType} value={jobType}>
                    {jobTypeLabels[jobType]}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label htmlFor="description" style={labelStyle}>
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the role and responsibilities"
                rows={5}
                required
                disabled={isLoadingJob || isSaving}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={fieldStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={labelStyle}>Skills needed</label>
                <button 
                  type="button" 
                  onClick={extractSkills} 
                  style={{...secondaryButtonStyle, padding: "6px 12px", fontSize: "0.875rem"}}
                  disabled={isExtracting || !description.trim()}
                >
                  {isExtracting ? "Extracting..." : "Auto-extract from description"}
                </button>
              </div>
              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {skills.length > 0 ? (
                    skills.map((skill, index) => (
                      <span
                        key={`${skill}-${index}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#f3f4f6",
                          borderRadius: "999px",
                          padding: "6px 10px",
                          fontSize: "14px",
                          color: "#111827",
                        }}
                      >
                        {skill}
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            aria-label={`Remove ${skill}`}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#374151",
                              cursor: "pointer",
                              fontSize: "14px",
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: "#6b7280" }}>
                      No skills added yet.
                    </span>
                  )}
                </div>

                {!isEditing && (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Add skill and press Enter"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      style={secondaryButtonStyle}
                    >
                      Add skill
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={isLoadingJob || isSaving}
                style={{
                  ...primaryButtonStyle,
                  opacity: isLoadingJob || isSaving ? 0.65 : 1,
                  cursor: isLoadingJob || isSaving ? "not-allowed" : "pointer",
                }}
              >
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Save description"
                    : "Post job"}
              </button>
              <Link
                to="/company/jobs"
                style={{
                  color: "#2563eb",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to jobs
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
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

const disabledInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#f8fafc",
  color: "#475569",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 20px",
  border: "none",
  borderRadius: "10px",
  background: "#2563eb",
  color: "#fff",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#f8fafc",
  cursor: "pointer",
  color: "#111827",
  fontWeight: 600,
};

const getJobErrorMessage = (
  data: unknown,
  fallback = "Unable to create the job. Please check the details and try again.",
) => {
  if (!data || typeof data !== "object") {
    return fallback;
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

  return fallback;
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

export default JobPage;
