import { useNavigate } from "react-router-dom";
import "./Welcome.css";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="welcome-root">
      {/* ── Header ── */}
      <header className="welcome-header">
        <h1 className="welcome-logo">SeaJobs</h1>
        <button
          type="button"
          className="welcome-header-login-btn"
          onClick={() => navigate("/login")}
        >
          Login
        </button>
      </header>

      {/* ── Hero ── */}
      <main className="welcome-main">
        <h2 className="welcome-headline">Where Students and Companies Meet</h2>

        <p className="welcome-subheadline">
          SeaJobs matches applicants to job opportunities that truly fit.
          Get started by registering below.
        </p>

        <div className="welcome-cards">
          {/* Applicant card */}
          <div
            className="welcome-card"
            onClick={() => navigate("/register/applicant")}
          >
            <p className="welcome-card-title">I'm an Applicant</p>
            <p className="welcome-card-desc">
              Find roles that match your skills and career goals.
            </p>
            <button
              type="button"
              className="welcome-card-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/register/applicant");
              }}
            >
              Register as Applicant
            </button>
          </div>

          {/* Company card */}
          <div
            className="welcome-card"
            onClick={() => navigate("/register/company")}
          >
            <p className="welcome-card-title">I'm a Company</p>
            <p className="welcome-card-desc">
              Post jobs and discover candidates who are the right fit.
            </p>
            <button
              type="button"
              className="welcome-card-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/register/company");
              }}
            >
              Register as Company
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Welcome;
