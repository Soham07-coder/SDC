import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../components/styles/facPending.css"; // Keep if you have custom CSS not covered by Tailwind

const FacRejectedApplications = () => {
  const [applications, setApplications] = useState([]); // Renamed from 'rejected' for consistency with other components
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // --- New States for Edit Remarks Modal ---
  const [showModal, setShowModal] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [editedRemarks, setEditedRemarks] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false); // To show loading state for save operation
  const [saveError, setSaveError] = useState(null);       // To show error for save operation

  /**
   * Fetches rejected applications from the backend API.
   * Manages loading and error states during the fetch operation.
   * THIS LOGIC REMAINS UNCHANGED AS PER REQUEST.
   */
  const fetchApplications = async () => {
    setLoading(true); // Indicate that data fetching has started
    setError(null);   // Clear any previous errors

    try {
      // Make the API call to your backend endpoint for rejected applications
      const res = await fetch(`http://localhost:5000/api/facapplication/rejected?all=true`);

      // Check if the HTTP response was successful (status code 2xx)
      if (!res.ok) {
        // If the response is not OK, throw an error with status details
        throw new Error(`HTTP error! Status: ${res.status} ${res.statusText}`);
      }

      const data = await res.json(); // Parse the JSON response body
      setApplications(data); // Update the state with the fetched applications
    } catch (err) {
      // Catch any errors during the fetch or parsing process
      console.error("Error fetching faculty rejected applications:", err);
      setError(err.message); // Set the error state to display to the user
    } finally {
      setLoading(false); // Always set loading to false after the operation completes (success or failure)
    }
  };

  // useEffect hook to call fetchApplications when the component mounts
  useEffect(() => {
    fetchApplications();
  }, []); // Empty dependency array ensures this runs only once on component mount

  /**
   * Handles click for the 'View' button, navigating to application details.
   */
  const handleViewClick = (id) => {
    navigate(`/application/${id}`);
  };

  /**
   * Handles click for the 'Edit' button, opening the remarks modal.
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
    if (!currentApp || !editedRemarks.trim()) {
      setSaveError("Remarks cannot be empty.");
      return;
    }

    setSavingRemarks(true);
    setSaveError(null);

    try {
      // Assuming your backend has an endpoint like /api/applications/:id for updates
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

  // Conditional rendering based on loading and error states for the main page
  if (loading) {
    return (
      <div className="main-wrapper">
        <Navbar />
        <Sidebar />
        <div className="page-wrapper flex justify-center items-center min-h-screen">
          <div className="p-6 text-center text-lg text-gray-700">Loading rejected applications...</div>
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
          <h2 className="page-title text-3xl font-bold mb-6 text-gray-800">Rejected Applications</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Here you can review applications that have been rejected, along with the provided remarks.
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
                {applications.length > 0 ? (
                  applications.map((app) => (
                    <tr key={app._id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                      <td className="p-4 font-medium text-blue-700">{app.formType || "N/A"}</td>
                      <td className="p-4 text-gray-800">{app.name || "N/A"}</td>
                      <td className="p-4 text-gray-700">
                        {app.rollNumber || app.rollNo || app.students?.[0]?.rollNo || app.studentDetails?.[0]?.rollNumber || "N/A"}
                      </td>
                      <td className="p-4 text-gray-700">
                        {/* Format the submitted date and time for user readability */}
                        {new Date(app.submitted).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true // Use 12-hour format (e.g., 05:22 PM)
                        })}
                      </td>
                      <td className="p-4 text-gray-700">{app.branch || "N/A"}</td>
                      <td className="p-4 text-red-600">{app.remarks || "No remarks provided."}</td> {/* Display remarks */}
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
                ) : (
                  <tr>
                    {/* colSpan is now 7 for the additional Action column */}
                    <td colSpan="7" className="text-center text-gray-500 py-6 text-base">
                      No rejected applications found.
                    </td>
                  </tr>
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

export default FacRejectedApplications;