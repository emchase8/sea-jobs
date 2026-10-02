import "./Menu.css";
import { Link } from "react-router-dom";
import { slide as Menu } from "react-burger-menu";

const SideMenu = ({ userType }: { userType: string }) => {
  const isCompany = userType === "company";
  const isApplicant = userType === "applicant";

  return (
    <Menu>
      {isCompany ? (
        <>
          <Link className="menu-item" to="/company/jobs">
            My Jobs
          </Link>
          <Link className="menu-item" to="/company/job">
            Add Job
          </Link>
        </>
      ) : (
        <>
          <Link className="menu-item" to="/applicant/resume">
            Resume
          </Link>
          <Link className="menu-item" to="/applicant/match">
            Match
          </Link>
          <Link className="menu-item" to="/applicant/network">
            Network
          </Link>
          <Link className="menu-item" to="/applicant/interested">
            Interested
          </Link>
        </>
      )}

      <Link
        className="menu-item"
        to={isCompany ? "/company/account" : "/applicant/account"}
      >
        Account
      </Link>
      <Link className="menu-item" to="/" reloadDocument={true}>
        Log Out
      </Link>
    </Menu>
  );
};

export default SideMenu;
