import React, { useState, useEffect } from "react";
import axios from "axios"; // Keep axios for API calls
import "../components/styles/AddUser.css"; // Ensure this CSS contains styles for the new modals
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const AddUser = () => {
  const [svvNetId, setSvvNetId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Validator");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- NEW STATES FOR CUSTOM MODALS ---
  const [showAddModal, setShowAddModal] = useState(false); // For Add User modal
  const [showEditModal, setShowEditModal] = useState(false); // For Edit User modal
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false); // For Delete confirmation modal

  const [currentUser, setCurrentUser] = useState(null); // Stores user object for edit/delete
  const [editedSvvNetId, setEditedSvvNetId] = useState("");
  const [editedPassword, setEditedPassword] = useState("");
  const [editedRole, setEditedRole] = useState("");

  const [modalError, setModalError] = useState(""); // Error specific to the modal being open
  const [isSubmitting, setIsSubmitting] = useState(false); // For showing loading state on modal buttons

  /**
   * Fetches all users from the backend API.
   * Manages loading and error states for the main table.
   * LOGIC REMAINS UNCHANGED.
   */
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

  // Fetch users on component mount. LOGIC REMAINS UNCHANGED.
  useEffect(() => {
    fetchUsers();
  }, []);

  // --- Handlers for opening/closing modals ---

  const openAddModal = () => {
    setSvvNetId(""); // Clear form fields
    setPassword("");
    setRole("Validator");
    setModalError(""); // Clear previous errors
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setModalError("");
    setIsSubmitting(false);
  };

  const openEditModal = (user) => {
    setCurrentUser(user);
    setEditedSvvNetId(user.svvNetId);
    setEditedPassword(""); // Password input empty by default for security
    setEditedRole(user.role);
    setModalError("");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setCurrentUser(null);
    setEditedSvvNetId("");
    setEditedPassword("");
    setEditedRole("");
    setModalError("");
    setIsSubmitting(false);
  };

  const openDeleteConfirmModal = (user) => {
    setCurrentUser(user);
    setShowDeleteConfirmModal(true);
    setModalError("");
  };

  const closeDeleteConfirmModal = () => {
    setShowDeleteConfirmModal(false);
    setCurrentUser(null);
    setModalError("");
    setIsSubmitting(false);
  };

  // --- API Interaction Functions (Logic migrated from original `handleAddUser`, `handleDelete`, `handleEdit`) ---

  /**
   * Handles adding a new user via the modal.
   * Original `handleAddUser` logic is moved here with modal-specific error handling.
   */
  const handleAddNewUserSubmit = async () => {
    if (!svvNetId.endsWith("@somaiya.edu")) {
      setModalError("Only somaiya.edu emails are allowed.");
      return;
    }
    if (!password || password.length < 8) { // Added password length check
      setModalError("Password must be at least 8 characters.");
      return;
    }
    if (!svvNetId || !password || !role) {
      setModalError("Please fill in all fields (Email, Password, Role).");
      return;
    }

    setIsSubmitting(true);
    setModalError(""); // Clear any previous modal errors

    try {
      await axios.post("http://localhost:5000/api/users", { svvNetId, password, role });
      alert("User added successfully!"); // Using alert for success, can be replaced by a toast/custom success modal
      closeAddModal(); // Close modal on success
      fetchUsers(); // Refresh user list
    } catch (err) {
      console.error("Error adding user:", err);
      setModalError(err.response?.data?.message || err.message || "An unknown error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles deleting a user via the confirmation modal.
   * Original `handleDelete` logic is moved here.
   */
  const handleDeleteConfirm = async () => {
    if (!currentUser?._id) return; // Should not happen if modal opened correctly

    setIsSubmitting(true);
    setModalError("");

    try {
      await axios.delete(`http://localhost:5000/api/users/${currentUser._id}`);
      alert("User deleted successfully!"); // Using alert for success
      closeDeleteConfirmModal(); // Close modal on success
      fetchUsers(); // Refresh user list
    } catch (err) {
      console.error("Error deleting user:", err);
      setModalError(err.response?.data?.message || err.message || "An unknown error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles editing an existing user via the modal.
   * Original `handleEdit` logic is moved here with modal-specific error handling.
   */
  const handleEditUserSubmit = async () => {
    if (!currentUser?._id) { // Ensure we have a user to edit
      setModalError("No user selected for editing.");
      return;
    }
    if (!editedSvvNetId.endsWith("@somaiya.edu")) {
        setModalError("Only somaiya.edu emails are allowed for the new email.");
        return;
    }
    if (!editedSvvNetId || !editedRole) {
      setModalError("Email and Role cannot be empty.");
      return;
    }
    if (editedPassword && editedPassword.length < 8) {
        setModalError("New password must be at least 8 characters.");
        return;
    }

    setIsSubmitting(true);
    setModalError("");

    const updatedData = { svvNetId: editedSvvNetId, role: editedRole };
    if (editedPassword) {
      updatedData.password = editedPassword; // Only send password if it's being updated
    }

    try {
      await axios.put(`http://localhost:5000/api/users/${currentUser._id}`, updatedData);
      alert("User updated successfully!"); // Using alert for success
      closeEditModal(); // Close modal on success
      fetchUsers(); // Refresh user list
    } catch (err) {
      console.error("Error updating user:", err);
      setModalError(err.response?.data?.message || err.message || "An unknown error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Main Render Logic ---
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="add-user-page" style={{ paddingTop: "5rem" }}>
          <h2 className="section-title">Manage Users</h2> {/* Changed title for clarity */}

          {/* Add User Section */}
          <div className="add-user-card">
            <h3 className="add-user-title">Add New User</h3>
            <button className="add-user-button" onClick={openAddModal}>
              <i className="fas fa-plus"></i> Add New User
            </button>
          </div>

          {/* Current Users Table Section */}
          <div className="users-table-container">
            <h3 className="users-title">Current System Users</h3>
            {loading ? (
              <p>Loading users...</p>
            ) : error ? (
              <p className="error-message">Error: {error}</p>
            ) : users.length === 0 ? (
              <p className="no-users">No users found.</p>
            ) : (
              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Email (SVV Net ID)</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}> {/* Use _id for key as it's from backend */}
                        <td className="email-cell">{u.svvNetId}</td>
                        <td>
                          <span className={`role-badge ${u.role.toLowerCase().replace(/\s+/g, '-')}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button
                            className="action-btn edit-btn"
                            onClick={() => openEditModal(u)}
                          >
                            Edit
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => openDeleteConfirmModal(u)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- ADD USER MODAL --- */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Add New User</h3>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="add-email">Email (SVV Net ID)</label>
                <input
                  type="email"
                  id="add-email"
                  placeholder="user@somaiya.edu"
                  value={svvNetId}
                  onChange={(e) => { setSvvNetId(e.target.value); setModalError(""); }}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-password">Password</label>
                <input
                  type="text" // Changed to text to simplify demo, for production use 'password'
                  id="add-password"
                  placeholder="Enter password (min 8 characters)"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setModalError(""); }}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-role">Role</label>
                <select
                  id="add-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="Student">Student</option>
                  <option value="Validator">Validator</option>
                  <option value="Department Coordinator">Department Coordinator</option>
                  <option value="Institute Coordinator">Institute Coordinator</option>
                  <option value="HOD">HOD</option>
                  <option value="Principal">Principal</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              {modalError && <p className="modal-error-message">{modalError}</p>}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeAddModal} disabled={isSubmitting}>Cancel</button>
              <button className="submit-btn" onClick={handleAddNewUserSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Edit User: {currentUser?.svvNetId}</h3>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="edit-email">Email (SVV Net ID)</label>
                <input
                  type="email"
                  id="edit-email"
                  value={editedSvvNetId}
                  onChange={(e) => { setEditedSvvNetId(e.target.value); setModalError(""); }}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-password">New Password (leave blank to keep current)</label>
                <input
                  type="text" // Changed to text for demo, use 'password' in production
                  id="edit-password"
                  placeholder="Enter new password (min 8 characters)"
                  value={editedPassword}
                  onChange={(e) => { setEditedPassword(e.target.value); setModalError(""); }}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  value={editedRole}
                  onChange={(e) => setEditedRole(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="Student">Student</option>
                  <option value="Validator">Validator</option>
                  <option value="Department Coordinator">Department Coordinator</option>
                  <option value="Institute Coordinator">Institute Coordinator</option>
                  <option value="HOD">HOD</option>
                  <option value="Principal">Principal</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              {modalError && <p className="modal-error-message">{modalError}</p>}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeEditModal} disabled={isSubmitting}>Cancel</button>
              <button className="submit-btn" onClick={handleEditUserSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {showDeleteConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content small-modal"> {/* Add a class for smaller delete modal */}
            <h3 className="modal-title delete-title">Confirm Deletion</h3>
            <div className="modal-body">
              <p>Are you sure you want to delete the user: <strong>{currentUser?.svvNetId}</strong>?</p>
              {modalError && <p className="modal-error-message">{modalError}</p>}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeDeleteConfirmModal} disabled={isSubmitting}>No, Cancel</button>
              <button className="delete-confirm-btn" onClick={handleDeleteConfirm} disabled={isSubmitting}>
                {isSubmitting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddUser;