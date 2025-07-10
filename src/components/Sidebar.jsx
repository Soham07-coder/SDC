import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../pages/Sidebar.css";
import { FaClock, FaCheckCircle, FaTimesCircle, FaQuestionCircle, FaEnvelope, FaBars, FaTimes } from "react-icons/fa";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  const user = JSON.parse(localStorage.getItem("user"));
  // Get role and convert to lowercase for consistent matching in switch case
  const role = user?.role?.toLowerCase() || "applicant"; // Default to lowercase 'applicant'

  // Set portal label (can still use original case for display if desired)
  const portalLabel = `${user?.role || "Applicant"} Portal`; // Use original case for display

  useEffect(() => {
    const handleResize = () => {
      const currentIsMobile = window.innerWidth <= 768;
      setIsMobile(currentIsMobile);
      // Auto-close sidebar when resizing to desktop from mobile if it was open
      // or if it's mobile and sidebar is open
      if (!currentIsMobile && isOpen) { // if desktop and sidebar open, close it
        closeSidebar();
      }
      // If resizing *to* mobile while sidebar is open (e.g., from desktop where it's always visible),
      // we might want to keep it open or close it. Your current logic closes it.
      // The original logic `if (window.innerWidth <= 768 && isOpen)` would close it if it was open
      // and stayed open on mobile. This makes sure it closes when you *transition* to desktop from mobile and it was open.
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]); // Depend on isOpen to re-evaluate when sidebar state changes

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
      case "admin": // Admins might also have a dashboard with statuses
        return `/ad${type}`; // Example: /adPending, /adAccepted
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
    <>
      {/* Mobile Toggle Button - outside sidebar and fixed */}
      {isMobile && (
        <button
          className={`mobile-toggle ${isOpen ? "open" : ""}`}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      )}

      {/* The Sidebar itself */}
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Logo Section */}
        <div className="logo-container">
          <div className="logo-box">
            <h2>
              {/* Ensure portalLabel is split correctly, assuming two words */}
              {portalLabel.split(" ")[0]} <br /> {portalLabel.split(" ").slice(1).join(" ")}
            </h2>
            <p>Somaiya Vidyavihar University</p>
          </div>
        </div>

        {/* Sidebar Options */}
        <div className="sidebar-links">
          {/* Conditional rendering for "Application Forms" section */}
          {(role === "student" || role === "applicant") && (
            <div className="sidebar-section">
              <h3>Application Forms</h3>
              {/* Add specific links for forms here if needed, example: */}
              {/* <Link to="/apply" className="nav-item" onClick={closeSidebar}>Apply Now</Link> */}
            </div>
          )}

          {/* Application Status Section */}
          <div className="sidebar-section">
            <h3>Application Status</h3> {/* Changed <p> to <h3> for semantic structure */}
            <div className="status-list"> {/* Added a wrapper for status items for better styling */}
              <Link to={pendingLink} className="status-item" onClick={closeSidebar}>
                <FaClock className="status-icon" /> Pending
              </Link>

              <Link to={acceptedLink} className="status-item" onClick={closeSidebar}>
                <FaCheckCircle className="status-icon" /> Accepted
              </Link>

              <Link to={rejectedLink} className="status-item" onClick={closeSidebar}>
                <FaTimesCircle className="status-icon" /> Rejected
              </Link>
            </div>
          </div>

          {/* Support Section */}
          <div className="sidebar-section">
            <h3>Support</h3> {/* Added a header for the support section */}
            <div className="status-list"> {/* Reusing status-list class, or create new like support-list */}
              <Link to="/faqs" className="status-item" onClick={closeSidebar}>
                <FaQuestionCircle className="status-icon" /> FAQ's
              </Link>
              <Link to="/contact" className="status-item" onClick={closeSidebar}>
                <FaEnvelope className="status-icon" /> Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {isMobile && isOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}
    </>
  );
};

export default Sidebar;