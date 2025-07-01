import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import formMapper from "../components/FormComponent/FormMapper"; // Ensure this path is correct

const ApplicationDetails = () => {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null); // State to store userRole
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplication = async () => {
      setLoading(true);
      setError(null);

      let userBranch = null;
      let svvNetId = null;
      let currentUserRole = null; // Use a temporary variable for retrieval

      const userString = localStorage.getItem("user");
      if (userString) {
        try {
          const user = JSON.parse(userString);
          userBranch = user.branch;
          svvNetId = user.svvNetId;
          currentUserRole = user.role; // <<< Retrieve the user's role
          setUserRole(currentUserRole); // Set userRole in component state
        } catch (e) {
          console.error("Failed to parse user data from localStorage for ApplicationDetails:", e);
          localStorage.removeItem("user");
          localStorage.removeItem("token"); // Assuming 'token' is also stored
          setError("User session corrupted. Please log in again.");
          setLoading(false);
          // navigate('/login'); // Uncomment to redirect to login
          return;
        }
      }

      if (!svvNetId || !currentUserRole) { // Use currentUserRole for this check
        setError("User authentication or role information missing. Please log in to view application details.");
        setLoading(false);
        // navigate('/login'); // Uncomment to redirect to login
        return;
      }

      try {
        const url = `http://localhost:5000/api/application/${id}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add Authorization header here if you're using JWTs for authentication
            // 'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            userBranch: userBranch,
            svvNetId: svvNetId,
            role: currentUserRole // <<< Send the user's role to the backend
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          let errorMessage = `Failed to fetch application details (status ${res.status}): ${text}`;

          if (res.status === 404) {
            errorMessage = "Application not found or you don't have permission to access it.";
          } else if (res.status === 400 && text.includes("svvNetId is required")) {
            errorMessage = "Authentication error: svvNetId missing. Please log in.";
          }
          throw new Error(errorMessage);
        }
        const data = await res.json();
        setApplication(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchApplication();
  }, [id, navigate]); // Add userRole to dependency array if you plan to react to changes, though not strictly necessary for initial fetch

  if (loading) return <div className="p-6">Loading application details...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!application) return <div className="p-6">No application found.</div>;

  const FormComponent = formMapper[application.formType];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Application Details</h1>
      <div className="mb-4 text-gray-600 space-y-1">
        <p><strong>Topic:</strong> {
          application.topic && application.topic !== "Untitled Project"
            ? application.topic
            : application.projectTitle ||
            application.titleOfSTTP ||
            application.formTitle ||
            application.title ||
            'N/A'
        }</p>
        <p><strong>Applicant Name:</strong> {application.name || 'N/A'}</p>
        <p><strong>Submitted on:</strong> {new Date(application.submitted).toLocaleDateString()}</p>
        <p><strong>Branch:</strong> {application.branch || 'N/A'}</p>
        <p><strong>Form Type:</strong> {application.formType || 'N/A'}</p>
        <p><strong>Status:</strong> {application.status || 'N/A'}</p>
      </div>

      {FormComponent ? (
        // *** KEY CHANGE HERE: Pass userRole as a prop ***
        <FormComponent data={application} viewOnly={true} userRole={userRole} />
      ) : (
        <p className="text-red-500">Unknown form type: {application.formType}</p>
      )}
    </div>
  );
};

export default ApplicationDetails;