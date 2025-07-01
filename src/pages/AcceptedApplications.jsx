// StudentAccepted.js
import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../components/styles/facPending.css";
import { useNavigate } from "react-router-dom";

const AcceeptedApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError(null);

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
            console.error("Failed to parse user data from localStorage:", e);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            setError("User session corrupted. Please log in again.");
            setLoading(false);
            return;
          }
        }

        if (!svvNetId) {
          setError("User not authenticated. Please log in to view accepted applications.");
          setLoading(false);
          return;
        }

        const baseUrl = "http://localhost:5000/api/application/accepted";
        const params = new URLSearchParams();
        if (userBranch) params.append("userBranch", userBranch);
        params.append("svvNetId", svvNetId);

        const url = `${baseUrl}?${params.toString()}`;
        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          let errorMessage = `Failed to fetch accepted applications: ${res.status} ${text}`;
          if (res.status === 400 && text.includes("svvNetId is required")) {
            errorMessage = "Authentication error: svvNetId missing from request.";
          } else if (res.status === 401 || res.status === 403) {
            errorMessage = "You are not authorized to view these applications.";
          }
          throw new Error(errorMessage);
        }

        const data = await res.json();
        setApplications(data);
      } catch (err) {
        console.error("Error fetching accepted applications:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const handleViewClick = (id) => {
    let userBranch = null;
    let svvNetId = null;
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        userBranch = user.branch;
        svvNetId = user.svvNetId;
      } catch (e) {
        console.error("Failed to parse user data for view click:", e);
      }
    }

    const params = new URLSearchParams();
    if (userBranch) params.append("userBranch", userBranch);
    if (svvNetId) params.append("svvNetId", svvNetId);

    navigate(`/application/${id}?${params.toString()}`);
  };

  if (loading) return <div className="p-6">Loading accepted applications...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  return (
    <div className="main-wrapper">
      <Navbar />
      <Sidebar />
      <div className="page-wrapper">
        <div className="content-area">
          <h2 className="page-title">Accepted Applications</h2>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
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
                  No accepted applications found.
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr key={app._id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{app.topic || "N/A"}</td>
                  <td className="p-3">{app.name || "N/A"}</td>
                  <td className="p-3">
                    {new Date(app.submitted).toLocaleDateString()}
                  </td>
                  <td className="p-3">{app.branch || "N/A"}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleViewClick(app._id)}
                      className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
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
        </div>
      </div>
    </div>
  );
};

export default AcceeptedApplications;
