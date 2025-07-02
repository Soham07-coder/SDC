import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../style.css";
import somaiyaLogo from "../assets/somaiya-logo.png";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Use state to track user from localStorage
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const userName = user?.svvNetId?.split("@")[0] || "User";
  const userRole = user?.role?.toLowerCase() || "student"; // Ensure lowercase role

  // Clean display role: capitalize first letter of each word
  const capitalize = (role) =>
    role
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  let displayRole = userRole === "validator" ? "Faculty" : capitalize(userRole);

  // Dynamic home routing based on lowercase roles
  const roleRoutes = {
    student: "/home",
    validator: "/facHome",
    faculty: "/facHome",
    admin: "/AdHome",
    "department coordinator": "/deptcoordHome",
    "institute coordinator": "/insticoordHome",
    hod: "/hodHome",
    principal: "/principalHome",
  };

  const homeLink = roleRoutes[userRole] || "/home";

  // Logout handler (optional: can also clear localStorage)
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("svvNetId");
    navigate("/"); // Redirect to login
  };

  return (
    <nav className="navbar-home">
      <div className="navbar-left">
        <img src={somaiyaLogo} alt="Somaiya Logo" className="navbar-logo" />
      </div>

      <div className="navbar-center">
        <Link to={homeLink} className="nav-link">Home</Link>
        <Link to="/dashboard" className="nav-link">Dashboard</Link>
        <Link to="/policy" className="nav-link">Policy</Link>
        <button className="nav-link logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      <div className="navbar-user-home">
        <span className="user-name">{userName}</span>
        <span className="user-role">{displayRole}</span>
      </div>
    </nav>
  );
};

export default Navbar;
