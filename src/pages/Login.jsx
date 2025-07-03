import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import "./login.css";
import logo from "../assets/somaiya-logo.png";
import logo1 from "../assets/trust.png";
import googleIcon from "../assets/google-logo.jpg";

const GOOGLE_CLIENT_ID = "653938123906-1qpf6dbs0u51auibm3lrmu3sg7a0gamh.apps.googleusercontent.com";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [studentError, setStudentError] = useState("");
  const [error, setError] = useState("");
  const [validatorError, setValidatorError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const hardcodedUsers = {
      "devanshu.d": { password: "Devanshu123", role: "student", branch: "(AI & DS)" },
      "sohamgore": { password: "12345678", role: "student", branch: "COMPS" },
      "faculty.a": { password: "faculty123", role: "validator", branch: "COMPS" },
    };

    const userEntry = hardcodedUsers[username];

    if (userEntry && userEntry.password === password) {
      const { role, branch } = userEntry;
      localStorage.setItem("svvNetId", username);
      localStorage.setItem("user", JSON.stringify({ svvNetId: username, role, branch }));

      // 🔁 Navigate based on role
      if (role === "validator") {
        navigate("/facHome");
      } else {
        navigate("/home");
      }
    } else {
      setError("Invalid SVV Net ID or password.");
    }
  };

  const VALIDATOR_EMAILS = [
    "devanshu.de@somaiya.edu",
    "smitasankhe@somaiya.edu",
    "vaibhav.vasani@somaiya.edu",
    "swapnil.cp@somaiya.edu",
  ];
  const DEPT_COORDINATORS = ["swapnil.cp@somaiya.edu","devanshu.de@somaiya.edu"];
  const INSTI_COORDINATORS = ["smitasankhe@somaiya.edu","devanshu.des@somaiya.edu"];
  const HOD_EMAILS = ["devanshu.dev@somaiya.edu","soham.gore@somaiya.edu"];
  const PRINCIPAL_EMAILS = ["principal.kjsce@somaiya.edu","devanshu.desa@somaiya.edu"];

  const handleGoogleSuccess = (credentialResponse, role = "Student") => {
    const setError = role === "Validator" ? setValidatorError : setStudentError;
    setError("");
    try {
      if (!credentialResponse.credential) {
        setError("Google login failed: No credential received.");
        alert("Google login failed: No credential received.");
        return;
      }

      const decoded = jwtDecode(credentialResponse.credential);
      console.log("Decoded Google JWT:", decoded);

      if (!decoded.email || !decoded.email.endsWith("@somaiya.edu")) {
        setError("Access denied: Only somaiya.edu emails are allowed.");
        alert("Access denied: Only somaiya.edu emails are allowed.");
        return;
      }

      let userRole = role;

      if (role === "Validator") {
        let matchedRoles = [];

        if (decoded.email === "sdc-kjsce@somaiya.edu" || decoded.email === "devanshu.d@somaiya.edu") {
          matchedRoles = ["Admin"];
        } else {
          if (VALIDATOR_EMAILS.includes(decoded.email)) matchedRoles.push("Validator");
          if (DEPT_COORDINATORS.includes(decoded.email)) matchedRoles.push("Department Coordinator");
          if (INSTI_COORDINATORS.includes(decoded.email)) matchedRoles.push("Institute Coordinator");
          if (HOD_EMAILS.includes(decoded.email)) matchedRoles.push("HOD");
          if (PRINCIPAL_EMAILS.includes(decoded.email)) matchedRoles.push("Principal");
        }

        if (matchedRoles.length === 0) {
          setError("Access denied: You are not authorized.");
          alert("Access denied: You are not authorized.");
          return;
        } else if (matchedRoles.length === 1) {
          userRole = matchedRoles[0];
        } else {
          const options = matchedRoles.map((r, i) => `${i + 1}. ${r}`).join("\n");
          const choice = prompt(`You have multiple roles:\n${options}\n\nEnter the number for your role:`);
          const index = parseInt(choice, 10) - 1;

          if (!isNaN(index) && index >= 0 && index < matchedRoles.length) {
            userRole = matchedRoles[index];
          } else {
            alert("Multiple roles detected. Please contact admin to resolve ambiguity.");
            return;
          }
        }
      }

      // No need for special student email check — any @somaiya.edu is allowed

      localStorage.setItem("svvNetId", decoded.email);
      localStorage.setItem("user", JSON.stringify({ svvNetId: decoded.email, role: userRole }));

      // Redirect
      switch (userRole) {
        case "Admin":
          navigate("/AdHome");
          break;
        case "Validator":
          navigate("/facHome");
          break;
        case "Department Coordinator":
          navigate("/deptcoordHome");
          break;
        case "Institute Coordinator":
          navigate("/insticoordHome");
          break;
        case "HOD":
          navigate("/hodHome");
          break;
        case "Principal":
          navigate("/principalHome");
          break;
        case "Student":
          navigate("/home");
          break;
        default:
          alert("No matching route for this role.");
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google login failed: Invalid token.");
      alert("Google login failed: Invalid token.");
    }
  };

  const handleGoogleError = (role = "Student") => {
    const setError = role === "Validator" ? setValidatorError : setStudentError;
    setError("Google login failed. Please try again.");
    alert("Google login failed. Please try again.");
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
          {/* Validator Section */}
          <div className="validator-box">
            <h1 className="validator-title">
              <span className="highlight">Student</span> <br />
              <span className="highlight">Development Cell</span>
            </h1>
            <p className="description">
              The Student Development Policy at K. J. Somaiya College of Engineering reflects our
              commitment to fostering a dynamic and enriching academic environment for students across all levels of study.
            </p>
            <h2 className="validator-question">Faculty / Coordinator / HOD?</h2>
            <p className="validator-login-text">Login to go on Dashboard</p>
            {validatorError && <p className="error-message">{validatorError}</p>}
            <GoogleLogin
              onSuccess={(credentialResponse) => handleGoogleSuccess(credentialResponse, "Validator")}
              onError={() => handleGoogleError("Validator")}
              width="100%"
              text="signin_with"
              shape="pill"
              logo_alignment="left"
              useOneTap
            />
          </div>

          {/* Student Login Box */}
          <div className="student-login-box">
            <h2 className="form-title">Please enter your SVV Net ID & password to Login.</h2>
            <form className="login-form" onSubmit={handleLogin}>
              <label>SVV Net ID *</label>
              <input
                type="text"
                placeholder="Enter your SVV Net ID"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <label>Password:</label>
              <input
                type="password"
                placeholder="Enter your password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="flex items-center space-x-2">
                <input type="checkbox" id="remember" className="w-4 h-4" />
                <label htmlFor="remember" className="text-sm">Remember me</label>
              </div>

              {error && <p className="error-message">{error}</p>}

              <button type="submit" className="login-button">Login</button>
            </form>
            <h1 className="or">OR</h1>
            <GoogleLogin
              onSuccess={(credentialResponse) => handleGoogleSuccess(credentialResponse, "Student")}
              onError={() => handleGoogleError("Student")}
              width="100%"
              text="signin_with"
              shape="pill"
              logo_alignment="left"
              useOneTap
            />
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;
