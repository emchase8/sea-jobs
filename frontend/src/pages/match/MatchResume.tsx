import { ApplicantUser } from "shared";

const formatDate = (date: Date | null) => {
  if (!date) return "Present";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
};

interface MatchResumeProps {
  applicant: ApplicantUser & { matchPercentage?: number | null };
}

const MatchResume = ({ applicant }: MatchResumeProps) => {
  const name = `${applicant.firstName} ${applicant.lastName}`;
  const resume = applicant.resume!;
  const matchPercentage = applicant.matchPercentage ?? null;

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
        width: "700px",
        maxWidth: "100%",
        maxHeight: "70vh",
        overflowY: "auto",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
        textAlign: "left",
      }}
    >
      <h1 style={{ margin: matchPercentage !== null ? "0 0 10px" : "0 0 25px", textAlign: "center" }}>{name}</h1>

      {matchPercentage !== null && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
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

      <section style={{ marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 8px" }}>Summary</h3>
        <p style={{ margin: 0, lineHeight: 1.5 }}>{resume.personalSummary}</p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 10px" }}>Skills</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {resume.skills.length > 0 ? (
            resume.skills.map((skill, index) => (
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

      <section>
        <h3 style={{ margin: "0 0 10px" }}>Experience</h3>
        {resume.experiences.length > 0 ? (
          resume.experiences.map((experience, index) => (
            <div
              key={`${experience.company}-${experience.title}-${index}`}
              style={{ marginBottom: "16px" }}
            >
              <strong>{experience.title}</strong>
              <div>
                {experience.company} · {experience.type}
              </div>
              <div>
                {formatDate(experience.start)} - {formatDate(experience.end)}
              </div>
              <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
                {experience.description}
              </p>
            </div>
          ))
        ) : (
          <p style={{ margin: 0 }}>No experience listed.</p>
        )}
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 10px" }}>Education</h3>
        {resume.education.length > 0 ? (
          resume.education.map((education, index) => (
            <div
              key={`${education.school}-${index}`}
              style={{ marginBottom: "16px" }}
            >
              <strong>{education.school}</strong>
              <div>
                {education.degree} {education.degreeType}
              </div>
              <div>{education.focus}</div>
              <div>
                {formatDate(education.start)} - {formatDate(education.end)}
              </div>
              <div>GPA: {education.gpa}</div>
              <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
                {education.description}
              </p>
            </div>
          ))
        ) : (
          <p style={{ margin: 0 }}>No education listed.</p>
        )}
      </section>

    </div>
  );
};
export default MatchResume;
