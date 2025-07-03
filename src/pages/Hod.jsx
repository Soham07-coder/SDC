import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../style.css";
import axios from "axios"; // Import axios

const HodDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true); // State for loading indicator
  const [error, setError] = useState(null); // State for error handling
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors before a new fetch

        // Make a POST request to your HOD dashboard endpoint
        // The second argument of axios.post is the request body.
        // For simply fetching all data, the body can be an empty object {}.
        // Ensure this URL exactly matches your backend route:
        // app.use("/api/facapplication", facapplicationRoutes);
        // router.post("/form/hodDashboard", ...)
        // So the full URL is http://localhost:5000/api/facapplication/form/hodDashboard
        const response = await axios.post("http://localhost:5000/api/facapplication/form/hodDashboard", {});

        // Process the data received from the backend
        const allApps = response.data.map((app) => ({
          ...app,
          // 'status' is now expected to be a string (e.g., "Pending", "Approved", "Rejected")
          // from the backend's processFormForDisplay function.
          status: app.status,
          // Generate validatorId on frontend if backend doesn't provide it
          validatorId: app.validatorId || generateValidatorID(),
        }));
        setApplications(allApps);
      } catch (err) {
        // Handle errors during the API call
        setError("Failed to fetch applications. Please try again.");
        console.error("Error fetching applications:", err);
      } finally {
        // Always set loading to false when the fetch operation completes
        setLoading(false);
      }
    };

    // Call the fetch function when the component mounts
    fetchApplications();
  }, []); // Empty dependency array means this effect runs once after initial render

  const getRollNumber = (app) => {
    return (
      app.rollNumber ||
      app.rollNo ||
      app.students?.[0]?.rollNo ||
      app.studentDetails?.[0]?.rollNumber ||
      "N/A"
    );
  };
  /**
   * Generates a unique Validator ID in the format VA_XXX.
   * @returns {string} The generated Validator ID.
   */
  const generateValidatorID = () => {
    const id = Math.floor(100 + Math.random() * 900); // Generates a random 3-digit number
    return `VA_${id}`;
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
                <p>HOD</p>
              </div>
            </div>

            <h2 className="dashboard-title">Recents</h2>
            {/* Conditional rendering based on loading and error states */}
            {loading && <p>Loading applications...</p>}
            {error && <p className="error-message">{error}</p>}
            {/* Render table only when not loading and no error */}
            {!loading && !error && (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Form</th>
                    <th>Applicant’s Roll No.</th>
                    <th>Application Date</th>
                    <th>Status</th>
                    <th>Validator ID</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length > 0 ? (
                    applications.map((app, index) => (
                      <tr key={index}>
                        <td>{app.topic || 'N/A'}</td> {/* Add fallback for display */}
                        <td>{getRollNumber(app)}</td>
                        <td>{app.submitted || 'N/A'}</td>
                        {/* Ensure app.status is a string for className, or provide fallback */}
                        <td className={`status ${app.status ? app.status.toLowerCase() : ''}`}>
                          {app.status || 'N/A'}
                        </td>
                        <td>{app.validatorId || 'N/A'}</td>
                        <td>
                          <button
                            className="view-btn"
                            onClick={() =>
                              // Navigate to the specific form view page
                              // Use app.path if available, otherwise fallback to formId
                              navigate(`/fachome/${app.path || (app.formId ? app.formId.toLowerCase() : '')}`)
                            }
                          >
                            View Form
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6">No Applications Found</td>
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

export default HodDashboard;
