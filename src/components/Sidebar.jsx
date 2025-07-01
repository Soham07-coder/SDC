import React from "react";
import { Link } from "react-router-dom";
import "../style.css";
import { FaClock, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

const Sidebar = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  // Get role and convert to lowercase for consistent matching in switch case
  const role = user?.role?.toLowerCase() || "applicant"; // Default to lowercase 'applicant'

  // Set portal label (can still use original case for display if desired)
  const portalLabel = `${user?.role || "Applicant"} Portal`; // Use original case for display

  // Set role-based routing
  const getRoute = (type) => {
    // The 'role' variable here is already lowercased from the const declaration above
    switch (role) {
      case "validator":
      case "faculty": // Assuming 'faculty' role also uses the /fac route prefix
        return `/fac${type}`; // e.g., /facPending, /facAccepted
      case "department coordinator":
        return `/deptcoord${type}`;
      case "institute coordinator":
        return `/insticoord${type}`;
      case "hod":
        return `/hod${type}`;
      case "principal":
        return `/principal${type}`;
      default:
        // Fallback for any other roles, might go to a generic dashboard or error page
        // Ensure this fallback path is valid in your routing setup.
        return `/${type.toLowerCase()}`;
    }
  };

  const pendingLink = getRoute("Pending");
  const acceptedLink = getRoute("Accepted");
  const rejectedLink = getRoute("Rejected");

  return (
    <div className="sidebar">
      {/* Logo Section */}
      <div className="logo-container">
        <div className="logo-box">
          <h2>
            {portalLabel.split(" ")[0]} <br /> {portalLabel.split(" ")[1]}
          </h2>
          <p>Somaiya Vidyavihar University</p>
        </div>
      </div>

      {/* Sidebar Options */}
      <div className="sidebar-links">
        {/* Only show 'Application Forms' if not faculty/admin etc.
            You might want to add conditional rendering here based on role */}
        {(role === "student" || role === "applicant") && <p>Application Forms</p>}


        {/* Application Status Section */}
        <div className="status-section">
          <p>Application Status</p>

          <div className="status-item">
            <Link to={pendingLink}>
              <FaClock className="status-icon" /> Pending
            </Link>
          </div>

          <div className="status-item">
            <Link to={acceptedLink}>
              <FaCheckCircle className="status-icon" /> Accepted
            </Link>
          </div>

          <div className="status-item">
            <Link to={rejectedLink}>
              <FaTimesCircle className="status-icon" /> Rejected
            </Link>
          </div>
        </div>

        {/* You might want to add conditional rendering for these links too */}
        <Link to="/faqs" className="nav-item">FAQ's</Link>
        <br />
        <Link to="/contact" className="nav-item">Contact Us</Link>
      </div>
    </div>
  );
};

export default Sidebar;