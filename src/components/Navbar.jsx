import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../style.css";
import somaiyaLogo from "../assets/somaiya-logo.png";

const Navbar = () => {
  const location = useLocation();
  
  // Use state to properly track user from localStorage
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const userName = user?.svvNetId?.split("@")[0] || "User";
  const userRole = user?.role || "Student";

  // Clean display for role names
  let displayRole = userRole === "Validator" ? "Faculty" : userRole;

  // Dynamic role-based home routing
  const roleRoutes = {
    Student: "/home",
    Validator: "/facHome",
    Faculty: "/facHome",
    Admin: "/AdHome",
    "Department Coordinator": "/deptcoordHome",
    "Institute Coordinator": "/insticoordHome",
    HOD: "/hodHome",
    Principal: "/principalHome",
  };

  const homeLink = roleRoutes[userRole] || "/home";

  return (
    <nav className="navbar-home">
      <div className="navbar-left">
        <img src={somaiyaLogo} alt="Somaiya Logo" className="navbar-logo" />
      </div>

      <div className="navbar-center">
        <Link to={homeLink} className="nav-link">Home</Link>
        <Link to="/dashboard" className="nav-link">Dashboard</Link>
        <Link to="/policy" className="nav-link">Policy</Link>
        <Link to="/" className="nav-link logout-btn">Logout</Link>
      </div>

      <div className="navbar-user-home">
        <span className="user-name">{userName}</span>
        <span className="user-role">{displayRole}</span>
      </div>
    </nav>
  );
};

export default Navbar;
