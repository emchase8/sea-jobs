interface MatchJobProps {
  company: CompanyUser;
  job: Job & { matchPercentage?: number | null };
}

const MatchJob = ({ company, job }: MatchJobProps) => {
  const matchPercentage = job.matchPercentage ?? null;

  let badgeBg = "#eff6ff";
  let badgeBorder = "#bfdbfe";
  let badgeColor = "#1d4ed8";
  let barGradient = "linear-gradient(90deg, #3b82f6, #60a5fa)";

  if (matchPercentage !== null) {
    if (matchPercentage >= 80) {
      badgeBg = "#ecfdf5";
      badgeBorder = "#a7f3d0";
      badgeColor = "#047857";
      barGradient = "linear-gradient(90deg, #10b981, #34d399)";
    } else if (matchPercentage < 60) {
      badgeBg = "#fffbeb";
      badgeBorder = "#fde68a";
      badgeColor = "#b45309";
      barGradient = "linear-gradient(90deg, #f59e0b, #fbbf24)";
    }
  }

  return (
    <div
      style={{
        backgroundColor: "white",
        width: "420px",
        maxWidth: "100%",
        maxHeight: "70vh",
        overflowY: "auto",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
        textAlign: "left"
      }}
    >
      <h2 style={{ margin: "0 0 8px", textAlign: "center", color: "#111827" }}>{job.jobTitle}</h2>

      <div style={{ marginBottom: matchPercentage !== null ? "12px" : "20px", fontWeight: 600, textAlign: "center", color: "#4b5563" }}>
        {company.companyName}
      </div>

      {matchPercentage !== null && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <span
            style={{
              backgroundColor: badgeBg,
              border: `1px solid ${badgeBorder}`,
              color: badgeColor,
              padding: "4px 14px",
              borderRadius: "999px",
              fontWeight: 700,
              fontSize: "0.9rem"
            }}
          >
            {matchPercentage}% Match
          </span>
        </div>
      )}

      <section style={{ marginBottom: "20px" }}>
        <div>
          <strong>Location:</strong> {job.location}
        </div>
        <div>
          <strong>Type:</strong> {job.type}
        </div>
        <div>
          <strong>Pay:</strong> ${job.payPerYear.toLocaleString()} /
          year
        </div>
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 10px" }}>Description</h3>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{job.description}</p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 10px" }}>Skills Needed</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {job.skillsNeeded.length > 0 ? (
            job.skillsNeeded.map((skill, index) => (
              <span
                key={`${skill}-${index}`}
                style={{
                  background: "#f3f4f6",
                  borderRadius: "999px",
                  padding: "6px 10px",
                  fontSize: "14px",
                }}
              >
                {skill}
              </span>
            ))
          ) : (
            <p style={{ margin: 0 }}>No skills listed.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default MatchJob;
