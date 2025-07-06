import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../style.css";

const AdminDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/facapplication/all-applications");
      setApplications(response.data);
    } catch (err) {
      console.error("Error fetching applications:", err);
      setError(err.response?.data?.message || "Failed to fetch applications.");
    } finally {
      setLoading(false);
    }
  };

  const getRollNumber = (app) => {
    return (
      app.rollNumber ||
      app.rollNo ||
      app.students?.[0]?.rollNo ||
      app.studentDetails?.[0]?.rollNumber ||
      "N/A"
    );
  };

  const handleViewClick = (id) => {
    navigate(`/application/${id}`); // Navigate to a specific application's detail page
  };

  const handleEdit = async (app) => {
    const newStatus = window.prompt("Enter new status: Approved / Rejected / Pending", app.status);
    if (!newStatus || !["Approved", "Rejected", "Pending"].includes(newStatus)) {
      alert("Invalid status. Use 'Approved', 'Rejected', or 'Pending'.");
      return;
    }

    const newRemarks = window.prompt("Enter new remarks:", app.remarks || "");
    if (!newRemarks) {
      alert("Remarks required.");
      return;
    }

    try {
      await axios.patch(`http://localhost:5000/api/facapplication/${app._id}/update-status`, {
        status: newStatus.toLowerCase(),
        remarks: newRemarks,
      });

      alert("Application status updated successfully!");
      fetchApplications(); // Reload applications
    } catch (err) {
      console.error("Error updating application:", err);
      alert(err.response?.data?.message || "Failed to update application.");
    }
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
                <p>Admin</p>
              </div>
            </div>

            <h2 className="dashboard-title">Recents</h2>

            {loading ? (
              <p>Loading applications...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : applications.length === 0 ? (
              <p>No Applications Found</p>
            ) : (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Form</th>
                    <th>Applicant’s Roll No.</th>
                    <th>Application Date</th>
                    <th>Status</th>
                    <th>Action</th>
                    <th>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app, index) => (
                    <tr key={index}>
                      <td>{app.formType || "Unknown Form"}</td>
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
                          onClick={() => handleViewClick(app._id)}// Make sure your form route expects this
                        >
                          View Form
                        </button>
                      </td>
                      <td>
                        <button className="edit-btn" onClick={() => handleEdit(app)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;