import { Routes, Route } from "react-router-dom";
import "./App.css";
import Welcome from "./welcome/Welcome.tsx";
import Login from "./auth/login/Login.tsx";
import ApplicantRegister from "./auth/register/applicant/applicantRegister.tsx";
import CompanyRegister from "./auth/register/company/companyRegister.tsx";
import Account from "./pages/account/Account.tsx";
import Resume from "./resume/Resume.tsx";
import Jobs from "./pages/jobs/Jobs.tsx";
import JobPage from "./pages/jobs/Job.tsx";
import Interested from "./pages/interested/Interested.tsx";
import CompanyInterested from "./pages/interested/CompanyInterested.tsx";
import Match from "./pages/match/Match.tsx";
import Network from "./pages/network/Network.tsx";
import { useUserInfo } from "./userInfo/userInfoHooks.ts";
import { CompanyUser } from "shared";

function App() {
  const { user, auth } = useUserInfo();

  const isAuth = () => {
    return !!user && !!auth;
  };

  if (isAuth()) {
    if (user instanceof CompanyUser) {
      return (
        <Routes>
          <Route
            path="/company/account"
            element={<Account userType="company" />}
          />
          <Route path="/company/jobs" element={<Jobs />} />
          <Route path="/company/job" element={<JobPage />} />
          <Route path="/company/job/:jobId/edit" element={<JobPage />} />
          <Route path="/company/match" element={<Match />} />
          <Route path="/company/interested" element={<CompanyInterested />} />
        </Routes>
      );
    }

    return (
      <Routes>
        <Route
          path="/applicant/account"
          element={<Account userType="applicant" />}
        />
        <Route path="/applicant/resume" element={<Resume />} />
        <Route path="/applicant/interested" element={<Interested />} />
        <Route path="/applicant/network" element={<Network />} />
        <Route
          path="/applicant/match"
          element={<Match/>}
        />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register/applicant" element={<ApplicantRegister />} />
      <Route path="/register/company" element={<CompanyRegister />} />
    </Routes>
  );
}

export default App;
