// src/pages/PendingApplications.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar"; // Re-added Navbar import
import Sidebar from "../components/Sidebar"; // Re-added Sidebar import
import "../components/styles/facPending.css"; // Re-added the CSS import if it contains base styles not covered by inline classes

const PendingApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true); // Set loading true at the start of fetch
      setError(null);   // Clear any previous errors

    const mockData = [
      {
        id:16014223035,
        topic: "UG_1",
        name: "Faculty_Computer_KJSCE",
        submitted: "24/03/2025",
        branch: "AIML",
      },
      {
        id: 16014210456,
        topic: "PG_2",
        name: "Faculty_Electronics_KJSCE",
        submitted: "25/03/2025",
        branch: "Electronics",
      },
      {
        id: 16014204256,
        topic: "UG_3",
        name: "Faculty_Mechanical_KJSCE",
        submitted: "26/03/2025",
        branch: "Mechanical",
      },
    ];

      try {
        let userBranch = null;
        let svvNetId = null;

        const userString = localStorage.getItem("user");
        if (userString) {
          try {
            const user = JSON.parse(userString);
            userBranch = user.branch;
            svvNetId = user.svvNetId;
          } catch (e) {
            console.error("Failed to parse user data from localStorage for PendingApplications:", e);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            setError("User session corrupted. Please log in again.");
            setLoading(false);
            // Optionally, navigate to login page here:
            // navigate('/login');
            return;
          }
        }

        // IMPORTANT: If svvNetId is not found, the user isn't authenticated for this action.
        if (!svvNetId) {
          setError("User not authenticated. Please log in to view pending applications.");
          setLoading(false);
          // Optionally, navigate to login page here:
          // navigate('/login');
          return;
        }

        // Construct the URL with both userBranch and svvNetId as query parameters
        const baseUrl = "http://localhost:5000/api/application/pending";
        const params = new URLSearchParams();

        if (userBranch) {
          params.append('userBranch', userBranch);
        }
        params.append('svvNetId', svvNetId); // <--- Crucial: Add svvNetId to query params

        const url = `${baseUrl}?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          let errorMessage = `Failed to fetch pending applications: ${res.status} ${text}`;
          // Enhance error messages for user clarity
          if (res.status === 400 && text.includes("svvNetId is required")) {
              errorMessage = "Authentication error: svvNetId missing from request. Please ensure you are logged in.";
          } else if (res.status === 401 || res.status === 403) {
              errorMessage = "You are not authorized to view these applications.";
          }
          throw new Error(errorMessage);
        }
        const data = await res.json();
        setApplications(data);
      } catch (err) {
        console.error("Error in PendingApplications fetch:", err); // Log the full error
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []); // Empty dependency array means this runs once on component mount

  const handleViewClick = (id) => {
    // When navigating to a specific application, also send the user's branch
    // AND svvNetId so the detail page can use it for its API call.
    let userBranch = null;
    let svvNetId = null;
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        userBranch = user.branch;
        svvNetId = user.svvNetId; // <--- Get svvNetId for navigation
      } catch (e) {
        console.error("Failed to parse user data for view click:", e);
      }
    }

    const params = new URLSearchParams();
    if (userBranch) {
      params.append('userBranch', userBranch);
    }
    if (svvNetId) { // <--- Add svvNetId to navigation query params
      params.append('svvNetId', svvNetId);
    }

    const queryParam = params.toString() ? `?${params.toString()}` : '';
    navigate(`/application/${id}${queryParam}`);
  };

  return (
    <div className="main-wrapper"> {/* Re-added main-wrapper */}
      <Navbar /> {/* Re-added Navbar */}
      <Sidebar /> {/* Re-added Sidebar */}
      <div className="page-wrapper"> {/* Re-added page-wrapper */}
        <div className="content-area"> {/* Re-added content-area */}
          {/* Content that was previously within the main div, now within content-area */}
          <div className="p-6 max-w-4xl mx-auto"> {/* Added styling from your last provided code */}
            <h2 className="text-2xl font-semibold mb-4">Pending Applications</h2>
            <p className="text-gray-600 mb-6">
              Easily track the details and statuses of all your submitted applications.
            </p>

            {loading && <div className="p-6">Loading pending applications...</div>}
            {error && <div className="p-6 text-red-600">Error: {error}</div>}

            {!loading && !error && (
              <div className="overflow-x-auto bg-white rounded shadow">
                <table className="w-full border text-left">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 border">Topic</th>
                      <th className="p-3 border">Name</th>
                      <th className="p-3 border">Submitted</th>
                      <th className="p-3 border">Branch</th>
                      <th className="p-3 border">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-gray-500 py-4">
                          No pending applications found.
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => (
                        <tr key={app._id} className="border-t hover:bg-gray-50">
                          <td className="p-3">{app.topic || 'N/A'}</td> {/* Add fallback for topic */}
                          <td className="p-3">{app.name || 'N/A'}</td>  {/* Add fallback for name */}
                          <td className="p-3">
                            {new Date(app.submitted).toLocaleDateString()}
                          </td>
                          <td className="p-3">{app.branch || 'N/A'}</td> {/* Add fallback for branch */}
                          <td className="p-3">
                            <button
                              onClick={() => handleViewClick(app._id)}
                              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default PendingApplications;