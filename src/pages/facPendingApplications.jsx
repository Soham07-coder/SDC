import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../components/styles/facPending.css";

const FacPendingApplications = () => {
  const [applications, setApplications] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApplications = async () => {
    setLoading(true); // Set loading to true before fetching
    setError(null); // Clear any previous errors

    try {
      // Make the API call to your backend
      const res = await fetch(`http://localhost:5000/api/facapplication/pending?all=true`);

      // Check if the response was successful (status 200-299)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
      }

      const data = await res.json(); // Parse the JSON response
      setApplications(data); // Update the applications state with fetched data
    } catch (err) {
      console.error("Error fetching faculty pending applications:", err);
      setError(err.message); // Set the error state if an error occurs
    } finally {
      setLoading(false); // Always set loading to false after the fetch operation
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []); 

  const handleAction = async (type, id) => {
    const actionName = type === "approve" ? "Approve" : "Reject";
    const statusToSet = type === "approve" ? "approved" : "rejected"; // Status string for DB

    const confirmed = window.confirm(`Are you sure you want to ${actionName} this application?`);
    if (!confirmed) return;

    let remarks = "";
    // Loop until remarks are provided or user cancels
    while (!remarks) {
      remarks = window.prompt(`Enter remarks for ${actionName}:`);
      if (remarks === null) { // User clicked cancel on prompt
        return;
      }
      if (!remarks.trim()) { // Check for empty or whitespace-only remarks
        alert("Remarks are required.");
      }
    }

    try {
      // API call to update the application status and remarks in the database
      const res = await fetch(`http://localhost:5000/api/facapplication/${id}/update-status`, {
        method: 'PATCH', // Use PATCH for partial updates
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${yourAuthToken}` // Uncomment and add if you have authentication
        },
        body: JSON.stringify({
          status: statusToSet,
          remarks: remarks.trim() // Trim whitespace from remarks
        }),
      });

      if (!res.ok) {
        const errorData = await res.json(); // Try to get error message from backend
        throw new Error(errorData.message || `Failed to ${actionName} application.`);
      }

      // If the API call is successful, update the local state: remove the acted-upon application
      const newList = applications.filter((app) => app._id !== id);
      setApplications(newList);

      // Navigate to the respective page after successful action
      navigate(`/${type === "approve" ? "facaccepted" : "facRejected"}`);

    } catch (err) {
      console.error(`Error ${actionName} application:`, err);
      alert(`Failed to ${actionName} application: ${err.message || "Please try again."}`);
      // Re-fetch applications to ensure state consistency if update failed on backend
      fetchApplications();
    }
  };

  const handleViewClick = (id) => {
    navigate(`/application/${id}`); // Navigate to a specific application's detail page
  };

  // Conditional rendering for loading and error states
  if (loading) {
    return <div className="p-6 text-center text-lg">Loading pending applications...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600 text-lg">Error: {error}. Please try again later.</div>;
  }

  return (
    <div className="main-wrapper">
      <Navbar />
      <Sidebar />
      <div className="page-wrapper">
        <div className="content-area">
          <h2 className="page-title">Pending Applications</h2>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Form Type</th>
                  <th>Topic</th>
                  <th>Name</th>
                  <th>Submitted</th>
                  <th>Branch</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                  {applications.length > 0 ? (
                      applications.map((app) => (
                          <tr key={app._id}> {/* CHANGE 1: Use app._id for the key */}
                              <td>{app.formType || "N/A"}</td>
                              <td>{app.topic || "N/A"}</td> {/* Added || "N/A" for safety */}
                              <td>{app.name || "N/A"}</td> {/* Added || "N/A" for safety */}
                              <td>
                                  {new Date(app.submitted).toLocaleString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true // Use AM/PM format
                                  })}
                              </td>
                              <td>{app.branch || "N/A"}</td> {/* Added || "N/A" for safety */}
                              <td>
                                  {/* The handleViewClick already uses app._id, which is correct */}
                                  <button onClick={() => handleViewClick(app._id)} className="view-button">View</button>
                                  {/* CHANGE 2: Use app._id when calling handleAction */}
                                  <button onClick={() => handleAction("approve", app._id)} className="approve-button">Approve</button>
                                  {/* CHANGE 3: Use app._id when calling handleAction */}
                                  <button onClick={() => handleAction("reject", app._id)} className="reject-button">Reject</button>
                              </td>
                          </tr>
                      ))
                  ) : (
                      <tr>
                          {/* CHANGE 4: Adjusted colSpan to 6 as per your current table headers (Form Type, Topic, Name, Submitted, Branch, Action) */}
                          <td colSpan="6" className="text-center">No Pending Applications</td>
                      </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacPendingApplications;