import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RequestMap from './RequestMap';

const UserDashboard = () => {
  const [user, setUser] = useState({ id: null, name: 'User', role: 'User', token: '' });
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', latitude: 40.7128, longitude: -74.0060 });
  const [loading, setLoading] = useState(false);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({ 
          id: parsed.id || null,
          name: parsed.name || 'User', 
          role: parsed.role || 'User',
          token: parsed.token || ''
        });
        
        // Fetch real requests when component mounts
        fetchRequests(parsed.token);
      } catch (e) {
        console.error('Error parsing user data', e);
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

  const handleAcceptRequest = async (id) => {
    try {
      await axios.post(`${apiUrl}/requests/${id}/accept`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      fetchRequests(user.token); // Refresh the list
    } catch (err) {
      console.error("Failed to accept request", err);
      alert(err.response?.data || "Unable to volunteer at this time.");
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/requests`, formData, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setShowModal(false);
      setFormData({ title: '', description: '', latitude: 40.7128, longitude: -74.0060 });
      fetchRequests(user.token); // Refresh the list
    } catch (err) {
      console.error("Failed to submit request", err);
      alert("Error: Ensure backend is running and you are logged in correctly.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="container mt-4 pt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="text-gradient">Welcome, {user.name}</h2>
          <p className="text-light opacity-75 mb-0">Manage your requests and community involvement here.</p>
        </div>
        <button onClick={handleLogout} className="neon-button-secondary">
          Logout
        </button>
      </div>

      <div className="row g-4">
        {/* Profile Card */}
        <div className="col-lg-4">
          <div className="glass-card h-100 d-flex flex-column align-items-center justify-content-center py-5">
            <div 
              className="rounded-circle bg-secondary mb-3 d-flex align-items-center justify-content-center"
              style={{ width: '100px', height: '100px', fontSize: '2rem' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h4 className="fw-bold">{user.name}</h4>
            <span className="badge bg-primary bg-opacity-25 text-primary border border-primary rounded-pill px-3 py-2 mb-4">
              {user.role}
            </span>
            <div className="d-flex gap-3 w-100 px-3">
              <button onClick={() => setShowModal(true)} className="neon-button w-100">
                New Request
              </button>
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="col-lg-8">
          <div className="glass-card h-100">
            <h4 className="mb-4">Community Requests</h4>
            <div className="table-responsive" style={{maxHeight: '350px'}}>
              <table className="table table-borderless text-light align-middle custom-glass-table">
                <thead className="position-sticky top-0 bg-dark" style={{zIndex: 1}}>
                  <tr className="text-muted border-bottom border-light border-opacity-10">
                    <th scope="col" className="pb-3 fw-medium">Title</th>
                    <th scope="col" className="pb-3 fw-medium">Author</th>
                    <th scope="col" className="pb-3 fw-medium">Status</th>
                    <th scope="col" className="pb-3 fw-medium text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length > 0 ? requests.map(req => (
                    <tr key={req.id} className="border-bottom border-light border-opacity-10">
                      <td className="py-3">
                        <div className="fw-bold">{req.title}</div>
                        <div className="small text-muted text-truncate" style={{maxWidth: '200px'}}>
                          {req.description}
                        </div>
                      </td>
                      <td className="py-3 text-muted">{req.author?.name || 'Unknown'}</td>
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
                        {(req.status === 'OPEN' || req.status === 'PENDING') && req.author?.id !== user.id && (
                          <button onClick={() => handleAcceptRequest(req.id)} className="btn btn-sm btn-outline-info rounded-pill px-3">
                            Volunteer
                          </button>
                        )}
                        {req.author?.id === user.id && (
                          <span className="small text-muted fst-italic">Yours</span>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="3" className="text-center py-4 text-muted">No requests found. Create one!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Panel / Map */}
        <div className="col-12 mt-4">
          <div className="glass-card">
            <h5 className="mb-3">Community Map</h5>
            <div className="w-100 rounded bg-dark border border-light border-opacity-10">
              <RequestMap requests={requests} currentUserId={user.id} onAccept={handleAcceptRequest} />
            </div>
          </div>
        </div>
      </div>

      {/* Modern Custom "Modal" using glassmorphism styling overlay */}
      {showModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050}}>
          <div className="glass-card animate-fade-in mx-3" style={{width: '500px', maxWidth: '100%'}}>
            <h4 className="text-gradient mb-3">Create New Request</h4>
            <form onSubmit={handleCreateRequest}>
              <div className="mb-3">
                <label className="text-muted small text-uppercase">Title</label>
                <input required type="text" className="form-control bg-dark border-secondary text-light"
                  value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder="E.g., Park Cleanup needed" />
              </div>
              <div className="mb-3">
                <label className="text-muted small text-uppercase">Description</label>
                <textarea required className="form-control bg-dark border-secondary text-light" rows="3"
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe what help you need..."></textarea>
              </div>
              <div className="row mb-4">
                <div className="col-6">
                  <label className="text-muted small text-uppercase">Latitude</label>
                  <input required type="number" step="any" className="form-control bg-dark border-secondary text-light"
                    value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} />
                </div>
                <div className="col-6">
                  <label className="text-muted small text-uppercase">Longitude</label>
                  <input required type="number" step="any" className="form-control bg-dark border-secondary text-light"
                    value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} />
                </div>
              </div>
              <div className="d-flex justify-content-end gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline-secondary">Cancel</button>
                <button type="submit" disabled={loading} className="neon-button">
                  {loading ? 'Submitting...' : 'Post Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
