import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios"; // Import axios for API calls
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../style.css"; // Assuming this contains your existing styles

const PrincipalDash = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true); // State for loading indicator
  const [error, setError] = useState(null); // State for error messages
  const navigate = useNavigate();

  // State and function for the message box
  const [messageBox, setMessageBox] = useState({ visible: false, text: '', type: '' });

  const showMessageBox = (text, type) => {
    setMessageBox({ visible: true, text, type });
    setTimeout(() => {
      setMessageBox({ visible: false, text: '', type: '' });
    }, 3000);
  };

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError(null); // Clear previous errors
      let svvNetId = '';
      let department = ''; // This will be set based on role for Principal
      let userRole = ''; // To explicitly get the user's role

      // Retrieve user data from localStorage for authentication/authorization
      const userString = localStorage.getItem("user");
      if (userString) {
        try {
          const user = JSON.parse(userString);
          svvNetId = typeof user.svvNetId === "string" ? user.svvNetId : Array.isArray(user.svvNetId) ? user.svvNetId[0] : "";
          userRole = typeof user.role === "string" ? user.role : ""; // Get the user's role

          // Assign a special identifier for Principal as they don't have a specific branch
          if (userRole === "Principal") {
            department = "PrincipalOffice";
          } else {
            // For other roles (e.g., HOD, student), use their specific branch
            department = typeof user.branch === "string" ? user.branch : Array.isArray(user.branch) ? user.branch[0] : "";
          }

          console.log("User from localStorage:", user);
          console.log("Extracted svvNetId:", svvNetId);
          console.log("Extracted Role:", userRole);
          console.log("Extracted Department (based on role):", department);

        } catch (e) {
          console.error("❌ Failed to parse user data from localStorage:", e);
          showMessageBox("User session corrupted. Please log in again.", "error");
          setLoading(false);
          return;
        }
      } else {
        showMessageBox("User not logged in. Please log in to view applications.", "error");
        setLoading(false);
        return;
      }

      // Check if essential user info is available before making API call
      if (!svvNetId || !department || !userRole) {
        showMessageBox("Authentication error: User ID, role, or department context not found. Please log in.", "error");
        setLoading(false);
        return;
      }

      try {
        // Make API call to fetch applications for the principal
        // The backend should recognize 'PrincipalOffice' or the 'X-User-Role' header
        // to fetch all applications, not just a specific department.
        const response = await axios.get("http://localhost:5000/api/facapplication/principal/applications", {
          headers: {
            'X-User-SvvNetId': svvNetId, // Custom header for svvNetId
            'X-User-Department': department, // This will now be "PrincipalOffice" for Principal
            'X-User-Role': userRole, // Pass the role explicitly for backend authorization
          }
        });

        // Assuming the backend returns an array of application objects,
        // each processed by `processFormForDisplay`
        setApplications(response.data);
        showMessageBox("Applications loaded successfully!", "success");

      } catch (err) {
        console.error("❌ Error fetching applications:", err.response?.data || err.message);
        setError("Failed to load applications. Please try again later.");
        showMessageBox("Failed to load applications. " + (err.response?.data?.message || err.message), "error");
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []); // Empty dependency array means this runs once on component mount

  const getRollNumber = (app) => {
    return (
      app.rollNumber ||
      app.rollNo ||
      app.students?.[0]?.rollNo ||
      app.studentDetails?.[0]?.rollNumber ||
      "N/A"
    );
  };

  const handleViewClick = (id) => {
    navigate(`/application/${id}`); // Navigate to a specific application's detail page
  };


  // Function to format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(); // e.g., "M/D/YYYY" or "DD/MM/YYYY"
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Invalid Date';
    }
  };

  return (
    <>
      <Navbar />
      <div className="home-container">
        <div className="container">
          <Sidebar />
          <main className="content">
            <div className="dashboard-header">
              <div className="role-box">
                <strong>Signed in as</strong>
                <p>Principal</p>
              </div>
            </div>

            <h2 className="dashboard-title">Recents</h2>

            {/* Message Box for user feedback */}
            {messageBox.visible && (
              <div className={`mb-4 p-3 rounded text-center ${messageBox.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {messageBox.text}
              </div>
            )}

            {loading && <p className="text-center text-gray-600">Loading applications...</p>}
            {error && <p className="text-center text-red-600">{error}</p>}

            {!loading && !error && (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Form Type</th> {/* New Column */}
                    <th>Title</th>     {/* New Column */}
                    <th>Applicant’s Roll No.</th>
                    <th>Application Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length > 0 ? (
                    applications.map((app) => (
                      <tr key={app._id}> {/* Use unique _id from backend */}
                        <td>{app.formType}</td> {/* Display Form Type */}
                        <td>{app.topic || 'N/A'}</td> {/* Display Title */}
                        <td>{getRollNumber(app)}</td> {/* 'id' is from processFormForDisplay */}
                        <td>{formatDate(app.submitted)}</td> {/* 'submitted' is from processFormForDisplay */}
                        <td className={`status ${app.status ? app.status.toLowerCase() : 'pending'}`}>
                          {app.status || 'Pending'}
                        </td>
                        <td>
                          <button
                            className="view-btn"
                            onClick={() => handleViewClick(app._id)}
                          >
                            View Form
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-gray-500">No Applications Found</td> {/* Adjusted colspan */}
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default PrincipalDash;