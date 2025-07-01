import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "../styles/FacUG1.css";

const FacPGForm2A = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/facapplication/form/pg2a", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("Failed to fetch PG_2_A applications");
        const data = await res.json();
        setApplications(data);
      } catch (err) {
        console.error("❌ Error loading PG_2_A applications:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  return (
    <>
      <Navbar />
      <main className="facug1-container">
        <div className="facug1-card">
          <h2 className="facug1-title">Applications for PG_2_A</h2>
          {loading ? (
            <p className="facug1-message">Loading applications...</p>
          ) : applications.length === 0 ? (
            <p className="facug1-message">No applications found.</p>
          ) : (
            <div className="facug1-table-wrapper">
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>Sr. No.</th>
                    <th>Student Name</th>
                    <th>Roll No.</th>
                    <th>Branch</th>
                    <th>Application Date</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app, index) => (
                    <tr key={app._id}>
                      <td className="left-blue">{index + 1}</td>
                      <td>{app.name || "N/A"}</td>
                      <td>{app.rollNumber || "N/A"}</td>
                      <td>{app.branch || "N/A"}</td>
                      <td>{new Date(app.createdAt).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default FacPGForm2A;
