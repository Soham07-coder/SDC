import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import axios from 'axios'; // Import axios for API calls
import "../style.css";

const InstCoordDash = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true); // State to manage loading status
  const [error, setError] = useState(null); // State to manage any errors during fetching
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true); // Set loading to true before fetching
        setError(null); // Clear any previous errors

        // Make a POST request to your backend endpoint
        const response = await axios.post("http://localhost:5000/api/facapplication/form/instCoordDashboard");
        // Assuming the backend returns an array of applications directly
        setApplications(response.data);
      } catch (err) {
        console.error("Error fetching applications for Institute Coordinator Dashboard:", err);
        setError("Failed to load applications. Please try again later."); // Set error message
      } finally {
        setLoading(false); // Set loading to false after fetching (whether success or error)
      }
    };

    fetchApplications();
  }, []); // Empty dependency array means this effect runs once on component mount
 
  // Roll number extractor
  const getRollNumber = (app) => {
    return (
      app.rollNumber ||
      app.rollNo ||
      app.students?.[0]?.rollNo ||
      app.studentDetails?.[0]?.rollNumber ||
      "N/A"
    );
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
                <p>Institute Coordinator</p>
              </div>
            </div>

            <h2 className="dashboard-title">Recents</h2>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Applicant’s Roll No.</th>
                  <th>Application Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.length > 0 ? (
                  applications.map((app, index) => (
                    <tr key={index}>
                      <td>{app.topic}</td>
                      <td>{getRollNumber(app)}</td>
                      <td>{new Date(app.submitted).toLocaleString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true // Use AM/PM format
                              })}</td>
                      <td className={`status ${app.status.toLowerCase()}`}>
                        {app.status}
                      </td>
                    
                      <td>
                        <button
                          className="view-btn"
                          onClick={() =>
                            navigate(`/facHome/${app.path || app.formId.toLowerCase()}`)
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
          </main>
        </div>
      </div>
    </>
  );
};

export default InstCoordDash;
