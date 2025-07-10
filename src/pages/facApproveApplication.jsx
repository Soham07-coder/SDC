import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../components/styles/facPending.css"; // Ensure this CSS file contains styles for modal

const FacAcceptedApplications = () => {
  const [applications, setApplications] = useState([]); // Renamed from 'approved' for consistency
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // For the 'View' button

  // --- NEW STATES FOR EDIT REMARKS MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [editedRemarks, setEditedRemarks] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false); // To show loading state for save operation
  const [saveError, setSaveError] = useState(null);       // To show error for save operation

  /**
   * Fetches accepted applications from the backend API.
   * Manages loading and error states.
   * THIS LOGIC REMAINS UNCHANGED AS PER YOUR REQUEST.
   */
  const fetchApplications = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`http://localhost:5000/api/facapplication/accepted?all=true`);
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setApplications(data); // Update state with fetched data
    } catch (err) {
      console.error("Error fetching faculty accepted applications:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch applications when the component mounts - REMAINS UNCHANGED
  useEffect(() => {
    fetchApplications();
  }, []);

  /**
   * Handles the click event for the "View" button.
   * Navigates to a detailed view page for the specific application.
   * @param {string} id The unique identifier of the application to view.
   */
  const handleViewClick = (id) => {
    navigate(`/application/${id}`); // Example route for viewing application details
  };

  /**
   * Handles click for the 'Edit Remarks' button, opening the remarks modal.
   * @param {object} app The application object to edit.
   */
  const handleEditClick = (app) => {
    setCurrentApp(app);
    setEditedRemarks(app.remarks || ""); // Pre-fill with existing remarks, or empty string if none
    setShowModal(true);
    setSaveError(null); // Clear any previous save errors
  };

  /**
   * Handles saving the edited remarks to the backend.
   */
  const handleSaveChanges = async () => {
    if (!editedRemarks.trim()) {
      setSaveError("Remarks cannot be empty.");
      return;
    }

    setSavingRemarks(true);
    setSaveError(null);

    try {
      // Assuming your backend has an endpoint like /api/applications/:id/remarks for updates
      // This endpoint needs to be able to update 'remarks' field.
      const res = await fetch(`http://localhost:5000/api/application/${currentApp._id}/remarks`, {
        method: "PUT", // or PATCH, depending on your API
        headers: {
          "Content-Type": "application/json",
          // Include authorization token if required by your API
          // 'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ remarks: editedRemarks }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to update remarks. Status: ${res.status}`);
      }

      // If save is successful, re-fetch applications to update the table
      await fetchApplications();
      setShowModal(false); // Close the modal
    } catch (err) {
      console.error("Error saving remarks:", err);
      setSaveError(err.message);
    } finally {
      setSavingRemarks(false);
    }
  };

  // Conditional rendering for loading and error states, including Navbar and Sidebar
  if (loading) {
    return (
      <div className="main-wrapper">
        <Navbar />
        <Sidebar />
        <div className="page-wrapper flex justify-center items-center min-h-screen">
          <div className="p-6 text-center text-lg text-gray-700">Loading accepted applications...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-wrapper">
        <Navbar />
        <Sidebar />
        <div className="page-wrapper flex justify-center items-center min-h-screen">
          <div className="p-6 text-center text-red-600 text-lg">Error: {error}. Please try again later.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-wrapper">
      <Navbar />
      <Sidebar />
      <div className="page-wrapper">
        <div className="content-area p-6 max-w-6xl mx-auto">
          <h2 className="page-title text-3xl font-bold mb-6 text-gray-800">Accepted Applications</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            These applications have been successfully approved and are available for your records or further processing.
            You can also edit the remarks if necessary.
          </p>

          <div className="table-wrapper overflow-x-auto bg-white rounded-lg shadow-md border border-gray-200">
            <table className="custom-table min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Form Type</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Roll No.</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Submitted On</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Branch</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Remarks</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {applications.length === 0 ? (
                  <tr>
                    {/* Colspan adjusted for 7 columns */}
                    <td colSpan="7" className="text-center text-gray-500 py-6 text-base">
                      No accepted applications found.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app._id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                      <td className="p-4 text-gray-800 font-medium">{app.formType || 'N/A'}</td>
                      <td className="p-4 text-gray-800">{app.name || 'N/A'}</td>
                      <td className="p-4 text-gray-700">
                        {app.rollNumber || app.rollNo || app.students?.[0]?.rollNo || app.studentDetails?.[0]?.rollNumber || "N/A"}
                      </td>
                      <td className="p-4 text-gray-700">
                        {/* Format the submitted date and time for user readability */}
                        {new Date(app.submitted).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true, // Use 12-hour format (e.g., 05:22 PM)
                        })}
                      </td>
                      <td className="p-4 text-gray-700">{app.branch || 'N/A'}</td>
                      <td className="p-4 text-gray-700">{app.remarks || 'No remarks provided.'}</td> {/* Display remarks */}
                      <td className="p-4 flex gap-2"> {/* Added flex and gap for buttons */}
                        <button
                          onClick={() => handleViewClick(app._id)}
                          className="view-button bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditClick(app)}
                          className="edit-btn"
                        >
                          Edit Remarks
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

      {/* Edit Remarks Modal */}
      {showModal && (
        <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="modal-content bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              Edit Remarks for {currentApp?.name} ({currentApp?.formType})
            </h3>
            <textarea
              value={editedRemarks}
              onChange={(e) => setEditedRemarks(e.target.value)}
              className="remarks-textarea w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              rows="6"
              placeholder="Enter remarks..."
              disabled={savingRemarks} // Disable textarea while saving
            />
            {saveError && (
              <p className="text-red-500 text-sm mt-2">{saveError}</p>
            )}
            <div className="modal-actions flex justify-end gap-3 mt-6">
              <button
                className="cancel-btn bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                onClick={() => setShowModal(false)}
                disabled={savingRemarks}
              >
                Cancel
              </button>
              <button
                className="save-btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                onClick={handleSaveChanges}
                disabled={savingRemarks}
              >
                {savingRemarks ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacAcceptedApplications;