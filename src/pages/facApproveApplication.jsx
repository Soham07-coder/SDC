import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Keep if you use navigate for 'View'
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../components/styles/facPending.css"; // Keep this if it contains shared or specific styles

const FacAcceptedApplications = () => {
  const [applications, setApplications] = useState([]); // Renamed from 'approved' for consistency
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // For the 'View' button

  /**
   * Fetches accepted applications from the backend API.
   * Manages loading and error states.
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

  // Fetch applications when the component mounts
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
          </p>

          <div className="table-wrapper overflow-x-auto bg-white rounded-lg shadow-md border border-gray-200">
            <table className="custom-table min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Form Type</th> {/* Changed from 'Form' to 'Form Type' */}
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Roll No.</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Submitted On</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Branch</th>
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                  {/* Assuming remarks are now on the detailed view, or if they're a field returned by your processFormForDisplay for this table, include: */}
                  <th className="p-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-gray-500 py-6 text-base"> {/* Colspan adjusted for new Remarks column */}
                      No accepted applications found.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app._id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                      <td className="p-4 text-gray-800 font-medium">{app.formType || 'N/A'}</td> {/* Using formType as available from processFormForDisplay */}
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
                      <td className="p-4">
                        <button
                          onClick={() => handleViewClick(app._id)}
                          className="view-button"
                        >
                          View
                        </button>
                      </td>
                      <td className="p-4 text-gray-700">{app.remarks || 'N/A'}</td> {/* Display remarks */}
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

export default FacAcceptedApplications;