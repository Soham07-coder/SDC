import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import axios from "axios"; // Re-import axios for backend calls

import "./login.css";
import logo from "../assets/somaiya-logo.png";
import logo1 from "../assets/trust.png";

const GOOGLE_CLIENT_ID = "653938123906-1qpf6dbs0u51auibm3lrmu3sg7a0gamh.apps.googleusercontent.com";

const Login = () => {
   // Changed email to svvNetId to align with backend expectations
  const [svvNetId, setSvvNetId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // Reintroduce loading state

  const navigate = useNavigate();

  // Hardcoded users for demo purposes (using email as key for Google matching)
  const hardcodedUsers = {
    // Students
    "devanshu.d@somaiya.edu": { password: "Devanshu123", role: "Student" },
    "sohamgore@somaiya.edu": { password: "12345678", role: "Student" },
    // Admin
    "sdc-kjsce@somaiya.edu": { password: "admin123", role: "Admin" },
    "devanshu.dee@somaiya.edu": { password: "admin123", role: "Admin" },
    // Add other roles if needed for hardcoding (e.g., Validator, Coordinator)
    "validator.a@somaiya.edu": { password: "val123", role: "Validator" },
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Attempt backend login first
      const response = await axios.post("http://localhost:5000/api/auth/login", { svvNetId, password });
      const { token, user } = response.data; // Assuming your backend sends token and user object

      localStorage.setItem("token", token);
      localStorage.setItem("svvNetId", user.svvNetId); // Use svvNetId from backend response
      localStorage.setItem("user", JSON.stringify(user)); // Store full user object from backend

      completeLogin(user.svvNetId, user.role); // Use role from backend
    } catch (err) {
      console.error("Backend login failed:", err.response?.data?.message || err.message);
      // Fallback to hardcoded/localStorage users if backend fails
      const userEntry = hardcodedUsers[svvNetId]; // Check hardcoded by svvNetId (email)

      if (userEntry && userEntry.password === password) {
        completeLogin(svvNetId, userEntry.role);
      } else {
        const storedUsers = JSON.parse(localStorage.getItem("userList")) || [];
        const foundUser = storedUsers.find(u => u.email === svvNetId && u.password === password); // Check stored by email

        if (foundUser) {
          completeLogin(svvNetId, foundUser.role);
        } else {
          setError("Invalid SVV Net ID or password.");
          // alert("Invalid SVV Net ID or password!"); // Uncomment if you prefer alerts
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (id, role) => {
    localStorage.setItem("svvNetId", id);
    localStorage.setItem("user", JSON.stringify({ svvNetId: id, role })); // Ensure consistent user object structure

    // Navigate based on role
    switch (role) {
      case "Admin": navigate("/AdHome"); break;
      case "Validator": navigate("/facHome"); break;
      case "Department Coordinator": navigate("/deptcoordHome"); break;
      case "Institute Coordinator": navigate("/insticoordHome"); break;
      case "HOD": navigate("/hodHome"); break;
      case "Principal": navigate("/principalHome"); break;
      case "Student": navigate("/home"); break; // Changed to "Student" for consistency
      default: navigate("/home");
    }
  };

  const handleGoogleSuccess = (credentialResponse) => {
    setError("");
    setLoading(true); // Set loading for Google login

    try {
      if (!credentialResponse.credential) {
        setError("Google login failed: No credential received.");
        // alert("Google login failed: No credential received.");
        return;
      }

      const decoded = jwtDecode(credentialResponse.credential);
      console.log("Decoded Google JWT:", decoded);

      if (!decoded.email || !decoded.email.endsWith("@somaiya.edu")) {
        setError("Access denied: Only somaiya.edu emails are allowed.");
        // alert("Access denied: Only somaiya.edu emails are allowed.");
        return;
      }

      let userRole = "Student"; // Default role for Somaiya emails

      // Check hardcoded users for role
      if (hardcodedUsers[decoded.email]) {
        userRole = hardcodedUsers[decoded.email].role;
      } else {
        // Check stored users for role
        const storedUsers = JSON.parse(localStorage.getItem("userList")) || [];
        const matchedUser = storedUsers.find((u) => u.email === decoded.email);
        if (matchedUser && matchedUser.role) {
          userRole = matchedUser.role;
        }
      }

      // Special cases for admin (can override other roles if explicitly defined)
      if (decoded.email === "sdc-kjsce@somaiya.edu" || decoded.email === "devanshu.dee@somaiya.edu") {
        userRole = "Admin";
      }

      completeLogin(decoded.email, userRole);
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google login failed: Invalid token or processing error.");
      // alert("Google login failed: Invalid token or processing error.");
    } finally {
      setLoading(false); // Stop loading after Google login attempt
    }
  };

  const handleGoogleError = () => {
    setError("Google login failed. Please try again.");
    // alert("Google login failed. Please try again.");
    setLoading(false);
  };


  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="login-page">
        <div className="navbar">
          <img src={logo} alt="Somaiya Logo" className="navbar-logo" />
          <h1 className="navbar-title">Welcome to Student Development Cell</h1>
          <img src={logo1} alt="Somaiya Trust Logo" className="navbar-logo1" />
        </div>

        <div className="login-container">
          <div className="login-box">
            <h1 className="login-title">
              <span className="highlight">Student</span>
              <span className="highlight">Development Cell</span>
            </h1>
            <p className="description">
              The Student Development Policy at K. J. Somaiya School of Engineering reflects our
              commitment to fostering a dynamic and enriching academic environment for students across all levels of study.
            </p>

            <h2 className="login-question">Login to your account</h2>

            <form onSubmit={handleLogin} className="login-form">
              <label>Email *</label>
              <input
                type="text" // Changed to text for SVV Net ID
                id="svv-net-id" // Added ID for label association
                className="login-input"
                placeholder="Enter your SVV Net ID"
                value={svvNetId} // Bind to svvNetId state
                onChange={(e) => { setSvvNetId(e.target.value); setError(""); }}
                required
                disabled={loading} // Disable during loading
              />

              <label>Password *</label>
              <input
                type="password"
                id="password" // Added ID for label association
                className="login-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                required
                disabled={loading} // Disable during loading
              />

              <div className="remember-me">
                <input type="checkbox" id="remember" />
                <label htmlFor="remember">Remember me</label>
              </div>

              {error && <p className="error-message">{error}</p>}

              <button type="submit" className="login-button">Login</button>
            </form>

            <div className="or">
              <span className="or-text">OR</span>
            </div>

            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              width="100%"
              text="signin_with"
              shape="pill"
              logo_alignment="left"
              useOneTap
              disabled={loading} // Disable during loading
            />
            {/* Added copyright info as per your image, adjust positioning with CSS */}
            <div className="copyright-info-bottom">
              © {new Date().getFullYear()} K. J. Somaiya College of Engineering. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;