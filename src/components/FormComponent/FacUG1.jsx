import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "../styles/FacUG1.css";

const FacUGForm1 = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/facapplication/form/ug1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}) // You can send faculty info here if needed (e.g. svvNetId, branch)
        });

        if (!res.ok) throw new Error("Failed to fetch UG_1 applications");

        const data = await res.json();
        console.log("✅ Fetched UG_1 applications:", data);
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
          <h2 className="facug1-title">Applications for UG-1</h2>

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
                      <td>
                        {new Date(app.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>{app.studentDetails?.[0]?.branch || "—"}</td>
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

export default FacUGForm1;
