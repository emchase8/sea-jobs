import { useState, useEffect } from "react";
import SideMenu from "../Menu.js";
import { useUserInfo } from "../../userInfo/userInfoHooks.js";
import "../match/Match.css";

type PeerExperience = {
  id?: number;
  title: string;
  company: string;
  description?: string;
  type?: string;
};

type PeerEducation = {
  id?: number;
  title: string;
  degree: string;
  major: string;
  gpa?: string | number;
};

type PeerResume = {
  id: number;
  owner: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  summary: string;
  skills: string[];
  experience: PeerExperience[];
  education: PeerEducation[];
  match_percentage?: number | null;
};

const Network = () => {
  const { auth } = useUserInfo();
  const [peers, setPeers] = useState<PeerResume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth) {
      fetchPeers();
    }
  }, [auth]);

  const fetchPeers = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/matching/peers/", {
        headers: {
          Authorization: `Token ${auth}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        setPeers(data);
      }
    } catch {
      setPeers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (isInterested: boolean) => {
    const currentPeer = peers[0];
    if (!currentPeer) return;

    // Optimistically advance queue
    setPeers((prev) => prev.slice(1));

    try {
      const res = await fetch("http://localhost:8000/api/swipe/peer/", {
        method: "POST",
        headers: {
          Authorization: `Token ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          peer_user_id: currentPeer.owner.id,
          is_interested: isInterested,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.is_mutual_match) {
        alert(`It's a Mutual Match with ${formatName(currentPeer.owner)}! Check your Interested page to reach out.`);
      }
    } catch (err) {
      console.error("Error recording peer swipe:", err);
    }
  };

  const formatName = (owner: PeerResume["owner"]) =>
    [owner.first_name, owner.last_name].filter(Boolean).join(" ") || owner.username;

  if (loading) {
    return (
      <>
        <SideMenu userType="applicant" />
        <div className="match-container">
          <div>Loading networking matches...</div>
        </div>
      </>
    );
  }

  const currentPeer = peers[0];
  if (!currentPeer) {
    return (
      <>
        <SideMenu userType="applicant" />
        <div className="match-container">
          <div>No more peer matches available right now!</div>
        </div>
      </>
    );
  }

  const matchPercentage = currentPeer.match_percentage ?? null;

  let badgeBg = "#eff6ff";
  let badgeBorder = "#bfdbfe";
  let badgeColor = "#1d4ed8";

  if (matchPercentage !== null) {
    if (matchPercentage >= 80) {
      badgeBg = "#ecfdf5";
      badgeBorder = "#a7f3d0";
      badgeColor = "#047857";
    } else if (matchPercentage < 60) {
      badgeBg = "#fffbeb";
      badgeBorder = "#fde68a";
      badgeColor = "#b45309";
    }
  }

  return (
    <>
      <SideMenu userType="applicant" />
      <div className="match-container">
        <div className="match-content">
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
            <h1 style={{ margin: matchPercentage !== null ? "0 0 6px" : "0 0 25px", textAlign: "center" }}>
              {formatName(currentPeer.owner)}
            </h1>

            <div style={{ textAlign: "center", color: "#4b5563", fontWeight: 600, marginBottom: "16px" }}>
              {currentPeer.owner.username}
            </div>

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
                    fontSize: "0.9rem",
                  }}
                >
                  {matchPercentage}% Match
                </span>
              </div>
            )}

            {currentPeer.summary && (
              <section style={{ marginBottom: "24px" }}>
                <h3 style={{ margin: "0 0 8px" }}>Summary</h3>
                <p style={{ margin: 0, lineHeight: 1.5 }}>{currentPeer.summary}</p>
              </section>
            )}

            <section style={{ marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 10px" }}>Skills</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {currentPeer.skills && currentPeer.skills.length > 0 ? (
                  currentPeer.skills.map((skill, index) => (
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

            {currentPeer.experience && currentPeer.experience.length > 0 && (
              <section style={{ marginBottom: "24px" }}>
                <h3 style={{ margin: "0 0 10px" }}>Experience</h3>
                {currentPeer.experience.map((experience, index) => (
                  <div key={`${experience.company}-${index}`} style={{ marginBottom: "16px" }}>
                    <strong>{experience.title}</strong>
                    <div>{experience.company}</div>
                    {experience.description && (
                      <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
                        {experience.description}
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )}

            {currentPeer.education && currentPeer.education.length > 0 && (
              <section>
                <h3 style={{ margin: "0 0 10px" }}>Education</h3>
                {currentPeer.education.map((education, index) => (
                  <div key={`${education.title}-${index}`} style={{ marginBottom: "16px" }}>
                    <strong>{education.title}</strong>
                    <div>
                      {education.degree} in {education.major}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
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

export default Network;
