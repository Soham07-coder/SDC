import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../components/styles/facPending.css"; // Keep if you have custom CSS not covered by Tailwind

const FacRejectedApplications = () => {
  const [applications, setApplications] = useState([]); // Renamed from 'rejected' for consistency with other components
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // Uncomment if you add a 'View' button later

  /**
   * Fetches rejected applications from the backend API.
   * Manages loading and error states during the fetch operation.
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

  // Example handleViewClick if you decide to add a 'View' button for rejected applications
  const handleViewClick = (id) => {
    navigate(`/application/${id}`);
  };

  // Conditional rendering based on loading and error states
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
                  {/* Uncomment if you want an action button like 'View' */}
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
                      {/* Uncomment if you want an action button like 'View' */}
                      <td className="p-4">
                        <button
                          onClick={() => handleViewClick(app._id)}
                          className="view-button"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    {/* Adjusted colSpan based on the number of columns (currently 6 including Remarks) */}
                    <td colSpan="6" className="text-center text-gray-500 py-6 text-base">
                      No rejected applications found.
                    </td>
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

export default FacRejectedApplications;