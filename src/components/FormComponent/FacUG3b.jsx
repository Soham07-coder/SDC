import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "../styles/FacUG1.css";

const FacUGForm3B = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/facapplication/form/ug3b", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("Failed to fetch UG_3B applications");

        const data = await res.json();
        setApplications(data);
      } catch (err) {
        console.error("❌ Error loading applications:", err);
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
          <h2 className="facug1-title">Applications for UG_3B</h2>

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
                    <th>Applicant’s Roll No.</th>
                    <th>Application Date</th>
                    <th>Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app, index) => (
                    <tr key={app._id}>
                      <td className="left-blue">{index + 1}</td>
                      <td>{app.studentDetails?.[0]?.rollNumber || "N/A"}</td>
                      <td>{new Date(app.createdAt).toLocaleDateString("en-GB")}</td>
                      <td>{app.department || "—"}</td>
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

export default FacUGForm3B;
