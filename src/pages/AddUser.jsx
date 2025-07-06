import React, { useState, useEffect } from "react";
import axios from "axios";
import "../components/styles/AddUser.css";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const AddUser = () => {
  const [svvNetId, setSvvNetId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Validator");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get("http://localhost:5000/api/users");
      setUsers(response.data);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.response?.data?.message || "Could not fetch users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async () => {
    if (!svvNetId.endsWith("@somaiya.edu")) {
      alert("Only somaiya.edu emails allowed");
      return;
    }

    if (!svvNetId || !password || !role) {
      alert("Please fill in all fields (Email, Password, Role).");
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/users", { svvNetId, password, role });
      alert("User added successfully!");
      setSvvNetId("");
      setPassword("");
      setRole("Validator");
      fetchUsers();
    } catch (err) {
      console.error("Error adding user:", err);
      console.log("Full error object:", err);
      alert(`Error adding user: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(`http://localhost:5000/api/users/${userId}`);
      alert("User deleted successfully!");
      fetchUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
      console.log("Full error object:", err);
      alert(`Error deleting user: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleEdit = async (userToEdit) => {
    const newSvvNetId = prompt("Enter new email", userToEdit.svvNetId);
    const newPassword = prompt("Enter new password (leave blank to keep current)", "");
    const newRole = prompt("Enter new role", userToEdit.role);

    if (newSvvNetId === null || newRole === null) return;

    if (!newSvvNetId || !newRole) {
      alert("Email and Role cannot be empty.");
      return;
    }

    const updatedData = { svvNetId: newSvvNetId, role: newRole };
    if (newPassword) updatedData.password = newPassword;

    try {
      await axios.put(`http://localhost:5000/api/users/${userToEdit._id}`, updatedData);
      alert("User updated successfully!");
      fetchUsers();
    } catch (err) {
      console.error("Error updating user:", err);
      console.log("Full error object:", err);
      alert(`Error updating user: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div className="layout-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="add-user-page" style={{ paddingTop: "5rem" }}>
          <h2>Add New User</h2>
          <div className="add-user-form">
            <input
              type="email"
              placeholder="Enter somaiya email"
              value={svvNetId}
              onChange={(e) => setSvvNetId(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="Student">Student</option>
              <option value="Validator">Validator</option>
              <option value="Department Coordinator">Department Coordinator</option>
              <option value="Institute Coordinator">Institute Coordinator</option>
              <option value="HOD">HOD</option>
              <option value="Principal">Principal</option>
              <option value="Admin">Admin</option>
            </select>
            <button onClick={handleAddUser}>Add User</button>
          </div>

          <h3>Current Users</h3>
          {loading ? (
            <p>Loading users...</p>
          ) : error ? (
            <p className="error-message">Error: {error}</p>
          ) : users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>{u.svvNetId}</td>
                    <td>{u.role}</td>
                    <td>
                      <button onClick={() => handleEdit(u)}>Edit</button>
                      <button onClick={() => handleDelete(u._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddUser;