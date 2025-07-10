import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../pages/Navbar.css";
import somaiyaLogo from "../assets/somaiya-logo.png";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Use state to track user from localStorage, initializes once
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // State for mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Effect to listen for changes in localStorage for 'user' and update state
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem("user");
      setUser(storedUser ? JSON.parse(storedUser) : null);
    };

    window.addEventListener("storage", handleStorageChange);
    // Also, initially set user if it somehow wasn't set on first render
    handleStorageChange(); // Call once on mount to ensure user state is fresh

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Effect for mobile responsiveness (resizing and closing menu)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) { // Assuming 768px as the breakpoint for mobile
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  const userName = user?.svvNetId?.split("@")[0] || "User";
  // Ensure userRole is always lowercase for consistent logic
  const userRole = user?.role?.toLowerCase() || "student";

  // Helper function to capitalize first letter of each word
  const capitalize = (str) =>
    str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  // Determine the role to display
  let displayRole = userRole === "validator" ? "Faculty" : capitalize(userRole);

  // Dynamic home routing based on lowercase roles
  const roleRoutes = {
    student: "/home",
    validator: "/facHome", // Validator role routes to facHome
    faculty: "/facHome", // Explicitly added for clarity if "Faculty" is a distinct role
    admin: "/AdHome",
    "department coordinator": "/deptcoordHome",
    "institute coordinator": "/insticoordHome",
    hod: "/hodHome",
    principal: "/principalHome",
  };

  const homeLink = roleRoutes[userRole] || "/home";

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("svvNetId"); // Remove if stored separately
    // Force a re-render by setting user to null
    setUser(null);
    navigate("/"); // Redirect to login page
  };

  // Function to close mobile menu
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navbar-home">
      <div className="navbar-left">
        <img src={somaiyaLogo} alt="Somaiya Logo" className="navbar-logo" />
      </div>

      {/* Hamburger Icon for Mobile */}
      <div
        className="hamburger"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <div className={isMobileMenuOpen ? "line line1-active" : "line"}></div>
        <div className={isMobileMenuOpen ? "line line2-active" : "line"}></div>
        <div className={isMobileMenuOpen ? "line line3-active" : "line"}></div>
      </div>

      {/* Navigation Links (responsive) */}
      <div className={`navbar-center ${isMobileMenuOpen ? "active" : ""}`}>
        <Link to={homeLink} className="nav-link" onClick={closeMobileMenu}>Home</Link>
        {userRole === "admin" ? (
          <Link to="/adduser" className="nav-link" onClick={closeMobileMenu}>Add User</Link>
        ) : (
          <Link to="/dashboard" className="nav-link" onClick={closeMobileMenu}>Dashboard</Link>
        )}
        <Link to="/policy" className="nav-link" onClick={closeMobileMenu}>Policy</Link>
        <button className="nav-link logout-btn" onClick={() => { handleLogout(); closeMobileMenu(); }}>
          Logout
        </button>
      </div>

      <div className="navbar-user-home">
        <span className="user-name">{userName}</span>
        <span className="user-role">{displayRole}</span>
      </div>
    </nav>
  );
};

export default Navbar;