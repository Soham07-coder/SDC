import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import axios from 'axios'; // Import axios for API calls
import "../style.css";

const InstCoordDash = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true); // State to manage loading status for main data fetch
  const [error, setError] = useState(null); // State to manage any errors during main data fetch
  const navigate = useNavigate();

  // --- NEW STATES FOR CUSTOM MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [currentAction, setCurrentAction] = useState(null); // 'approve' or 'reject'
  const [currentAppId, setCurrentAppId] = useState(null); // Stores the _id of the application for modal action
  const [modalLoading, setModalLoading] = useState(false); // For submit button in modal
  const [modalError, setModalError] = useState(null);     // For displaying errors in modal

  // Function to fetch applications
  const fetchApplications = async () => {
    setLoading(true); // Set loading to true before fetching
    setError(null); // Clear any previous errors

    try {
      // Make a POST request to your backend endpoint
      const response = await axios.post("http://localhost:5000/api/facapplication/form/instCoordDashboard");
      // Assuming the backend returns an array of applications directly
      setApplications(response.data);
    } catch (err) {
      console.error("Error fetching applications for Institute Coordinator Dashboard:", err);
      // Check if err.response exists for more detailed error from backend
      setError(err.response?.data?.message || "Failed to load applications. Please try again later.");
    } finally {
      setLoading(false); // Set loading to false after fetching (whether success or error)
    }
  };

  // useEffect hook to call fetchApplications when the component mounts
  useEffect(() => {
    fetchApplications();
  }, []); // Empty dependency array means this effect runs once on component mount

  // Handler for 'View' button click
  const handleViewClick = (id) => {
    navigate(`/application/${id}`); // Navigate to a specific application's detail page
  };

  // Handler for 'Approve' or 'Reject' button clicks
  const handleActionClick = (type, id) => {
    setCurrentAction(type);
    setCurrentAppId(id);
    setRemarks(""); // Clear remarks from previous use
    setModalError(null); // Clear previous modal errors
    setShowModal(true); // Open the modal
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
      // API call to update the application status and remarks in the database
      // Reusing the endpoint from FacPendingApplications, assuming it's generic enough
      const res = await axios.patch(`http://localhost:5000/api/facapplication/${currentAppId}/update-status`, {
        status: statusToSet,
        remarks: remarks.trim() // Trim whitespace from remarks
      });

      // If the API call is successful, update the local state: remove the acted-upon application
      // For a dashboard, we typically just remove the item or re-fetch.
      // Here, we'll remove it from the list to reflect the change immediately.
      const newList = applications.filter((app) => app._id !== currentAppId);
      setApplications(newList);

      // Reset modal states and close modal
      setRemarks("");
      setShowModal(false);
      setCurrentAction(null);
      setCurrentAppId(null);

      // No navigation here, as it's a dashboard, and the item is simply removed.
      // If specific navigation is desired, it can be added here.

    } catch (err) {
      console.error(`Error ${actionName} application:`, err);
      // Check if err.response exists for more detailed error from backend
      setModalError(`Failed to ${actionName} application: ${err.response?.data?.message || "Please try again."}`);
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

  // Roll number extractor (unchanged)
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
                          className="view-button"
                          onClick={() => handleViewClick(app._id)}
                        >
                          View Form
                        </button>
                        {/* New Approve/Reject buttons */}
                        <button
                          className="approve-btn"
                          onClick={() => handleActionClick("approve", app._id)}
                        >
                          Approve
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => handleActionClick("reject", app._id)}
                        >
                          Reject
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
    </>
  );
};

export default InstCoordDash;
