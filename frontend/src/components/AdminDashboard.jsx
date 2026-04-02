import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = () => {
  const [admin, setAdmin] = useState({ name: 'Admin', role: 'Admin', token: '' });
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setAdmin({ 
          name: parsed.name || 'Admin', 
          role: parsed.role || 'Admin', 
          token: parsed.token || '' 
        });
        fetchRequests(parsed.token);
      } catch (e) {
        console.error('Error parsing admin data', e);
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchRequests = async (token) => {
    try {
      const res = await axios.get(`${apiUrl}/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    }
  };

  const handleComplete = async (id) => {
    try {
      await axios.post(`${apiUrl}/requests/${id}/complete`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests(admin.token);
    } catch (err) {
      console.error("Failed to action request", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      if (window.confirm("Are you sure you want to delete this request permanently?")) {
        await axios.delete(`${apiUrl}/requests/${id}`, {
          headers: { Authorization: `Bearer ${admin.token}` }
        });
        fetchRequests(admin.token);
      }
    } catch (err) {
      console.error("Failed to delete request", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const totalUsers = "TBC"; // Typically fetched from a separate /admin endpoint
  const activeRequests = requests.filter(r => r.status && r.status !== 'COMPLETED').length;
  const completedTasks = requests.filter(r => r.status === 'COMPLETED').length;

  return (
    <div className="container mt-4 pt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="text-gradient">Admin Dashboard</h2>
          <p className="text-light opacity-75 mb-0">Manage system operations and approve community requests.</p>
        </div>
        <button onClick={handleLogout} className="neon-button-secondary">
          Logout
        </button>
      </div>

      {/* Metrics Row */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="glass-card text-center py-4 h-100">
            <h1 className="display-4 fw-bold text-gradient">{totalUsers}</h1>
            <p className="text-muted mb-0 text-uppercase fw-semibold tracking-wide">Total Users</p>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-card text-center py-4 h-100">
            <h1 className="display-4 fw-bold text-info">{activeRequests}</h1>
            <p className="text-muted mb-0 text-uppercase fw-semibold tracking-wide">Active Requests</p>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-card text-center py-4 h-100">
            <h1 className="display-4 fw-bold text-success">{completedTasks}</h1>
            <p className="text-muted mb-0 text-uppercase fw-semibold tracking-wide">Completed Tasks</p>
          </div>
        </div>
      </div>

      {/* Management Table */}
      <div className="row g-4">
        <div className="col-12">
          <div className="glass-card">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="mb-0">System Requests</h4>
              <button onClick={() => fetchRequests(admin.token)} className="neon-button-secondary btn-sm">Refresh Hub</button>
            </div>
            
            <div className="table-responsive">
              <table className="table table-borderless text-light align-middle custom-glass-table">
                <thead>
                  <tr className="text-muted border-bottom border-light border-opacity-10">
                    <th scope="col" className="pb-3 fw-medium">ID</th>
                    <th scope="col" className="pb-3 fw-medium">Title</th>
                    <th scope="col" className="pb-3 fw-medium">Author</th>
                    <th scope="col" className="pb-3 fw-medium">Status</th>
                    <th scope="col" className="pb-3 fw-medium text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length > 0 ? requests.map(req => (
                    <tr key={req.id} className="border-bottom border-light border-opacity-10">
                      <td className="py-3 text-muted">#{req.id}</td>
                      <td className="py-3 fw-semibold">{req.title}</td>
                      <td className="py-3">{req.author?.name || 'Unknown'}</td>
                      <td className="py-3">
                        <span className={`badge rounded-pill px-3 py-2 ${
                          req.status === 'COMPLETED' ? 'bg-success bg-opacity-25 text-success border border-success' :
                          req.status === 'IN_PROGRESS' ? 'bg-info bg-opacity-25 text-info border border-info' :
                          'bg-warning bg-opacity-25 text-warning border border-warning'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 text-end">
                        <div className="btn-group">
                          {req.status !== 'COMPLETED' && (
                            <button onClick={() => handleComplete(req.id)} className="btn btn-sm btn-outline-success rounded-pill px-3 me-2">Complete</button>
                          )}
                          <button onClick={() => handleDelete(req.id)} className="btn btn-sm btn-outline-danger rounded-pill px-3">Delete</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-muted">No requests found in database.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
