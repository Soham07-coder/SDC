import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../components/styles/facPending.css"; // Ensure this CSS file contains styles for modal

const FacPendingApplications = () => {
  const [applications, setApplications] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- NEW STATES FOR CUSTOM MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [currentAction, setCurrentAction] = useState(null); // 'approve' or 'reject'
  const [currentAppId, setCurrentAppId] = useState(null); // Stores the _id of the application for modal action
  const [modalLoading, setModalLoading] = useState(false); // For submit button in modal
  const [modalError, setModalError] = useState(null);     // For displaying errors in modal

  // Function to fetch applications - REMAINS UNCHANGED
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

  // useEffect hook to call fetchApplications when the component mounts - REMAINS UNCHANGED
  useEffect(() => {
    fetchApplications();
  }, []);

  // Handler for 'View', 'Approve', 'Reject' button clicks (modified)
  const handleActionClick = (type, id) => {
    // Confirm action before opening modal for remarks
    const actionName = type === "approve" ? "Approve" : "Reject";
    const confirmed = window.confirm(`Are you sure you want to ${actionName} this application?`);
    if (!confirmed) return;

    // Set states to open modal
    setCurrentAction(type);
    setCurrentAppId(id);
    setRemarks(""); // Clear remarks from previous use
    setModalError(null); // Clear previous modal errors
    setShowModal(true);
  };

  // Handles submitting remarks from the modal
  const handleModalSubmit = async () => {
    if (!remarks.trim()) {
      setModalError("Remarks are required.");
      return;
    }

    setModalLoading(true); // Start loading for modal submission
    setModalError(null); // Clear previous errors

    const statusToSet = currentAction === "approve" ? "approved" : "rejected";
    const actionName = currentAction === "approve" ? "Approve" : "Reject";

    try {
      // API call to update the application status and remarks in the database - REMAINS UNCHANGED LOGICALLY
      const res = await fetch(`http://localhost:5000/api/facapplication/${currentAppId}/update-status`, {
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
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${actionName} application.`);
      }

      // If the API call is successful, update the local state: remove the acted-upon application
      const newList = applications.filter((app) => app._id !== currentAppId);
      setApplications(newList);

      // Reset modal states and close modal
      setRemarks("");
      setShowModal(false);
      setCurrentAction(null);
      setCurrentAppId(null);

      // Navigate to the respective page after successful action
      navigate(`/${currentAction === "approve" ? "facaccepted" : "facRejected"}`);

    } catch (err) {
      console.error(`Error ${actionName} application:`, err);
      setModalError(`Failed to ${actionName} application: ${err.message || "Please try again."}`);
      // Re-fetch applications to ensure state consistency if update failed on backend
      fetchApplications(); // Fallback to re-fetch all
    } finally {
      setModalLoading(false); // End loading for modal submission
    }
  };

  // Handler for closing the modal
  const handleModalClose = () => {
    setShowModal(false);
    setRemarks("");
    setCurrentAction(null);
    setCurrentAppId(null);
    setModalError(null); // Clear error on close
    setModalLoading(false); // Reset loading state
  };

  // Handle View Click - REMAINS UNCHANGED
  const handleViewClick = (id) => {
    navigate(`/application/${id}`); // Navigate to a specific application's detail page
  };

  // Conditional rendering for loading and error states (for the main page content)
  if (loading) {
    return (
      <div className="main-wrapper">
        <Navbar />
        <Sidebar />
        <div className="page-wrapper">
          <div className="content-area p-6 text-center text-lg text-gray-700">Loading pending applications...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-wrapper">
        <Navbar />
        <Sidebar />
        <div className="page-wrapper">
          <div className="content-area p-6 text-center text-red-600 text-lg">Error: {error}. Please try again later.</div>
        </div>
      </div>
    );
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
                    <tr key={app._id}>
                      <td>{app.formType || "N/A"}</td>
                      <td>{app.topic || "N/A"}</td>
                      <td>{app.name || "N/A"}</td>
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
                      <td>{app.branch || "N/A"}</td>
                      <td>
                        <button onClick={() => handleViewClick(app._id)} className="view-button">View</button>
                        <button onClick={() => handleActionClick("approve", app._id)} className="approve-button">Approve</button>
                        <button onClick={() => handleActionClick("reject", app._id)} className="reject-button">Reject</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center">No Pending Applications</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- CUSTOM REMARKS MODAL --- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Enter Remarks for {currentAction === "approve" ? "Approval" : "Rejection"}</h3>
              <button className="modal-close" onClick={handleModalClose} disabled={modalLoading}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={`Enter remarks for ${currentAction === "approve" ? "approval" : "rejection"}...`}
                rows={6}
                disabled={modalLoading} // Disable while submitting
              />
              {modalError && <p className="modal-error-message">{modalError}</p>}
            </div>
            <div className="modal-footer">
              <button onClick={handleModalClose} className="modal-cancel" disabled={modalLoading}>
                Cancel
              </button>
              <button onClick={handleModalSubmit} className="modal-submit" disabled={modalLoading}>
                {modalLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacPendingApplications;