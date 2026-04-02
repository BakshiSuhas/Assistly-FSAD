import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
  const [admin] = useState(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      return { id: null, name: 'Admin', role: 'Admin', token: '' };
    }
    try {
      const parsed = JSON.parse(storedUser);
      return { id: parsed.id, name: parsed.name, role: parsed.role, token: parsed.token };
    } catch (err) {
      console.error('Error parsing admin data', err);
      return { id: null, name: 'Admin', role: 'Admin', token: '' };
    }
  });
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [communities, setCommunities] = useState([]);
  
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'users' | 'communities' | 'profile'

  // Profile logic
  const [profileData, setProfileData] = useState(null);
  const [profileEdit, setProfileEdit] = useState({ name: '', email: '' });

  const navigate = useNavigate();
  const apiUrl = 'http://localhost:8080/api';

  const fetchData = useCallback(async (token) => {
    try {
      const [reqRes, usrRes, comRes, profRes] = await Promise.all([
        axios.get(`${apiUrl}/requests`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/communities`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/users/profile`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setRequests(reqRes.data);
      setUsers(usrRes.data);
      setCommunities(comRes.data);
      setProfileData(profRes.data);
      setProfileEdit({ name: profRes.data.name, email: profRes.data.email });
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!admin.token) {
      navigate('/login');
      return;
    }
    if (admin.role !== 'ROLE_ADMIN' && admin.role !== 'ADMIN') {
      navigate('/dashboard/user');
      return;
    }
    queueMicrotask(() => {
      fetchData(admin.token);
    });
  }, [admin, fetchData, navigate]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${apiUrl}/users/${admin.id}`, profileEdit, { headers: { Authorization: `Bearer ${admin.token}` } });
      const stored = JSON.parse(localStorage.getItem('user'));
      stored.name = profileEdit.name;
      localStorage.setItem('user', JSON.stringify(stored));
      alert("Super Admin Identity updated successfully!");
    } catch (err) {
      console.error('Failed to update admin profile', err);
    }
  };

  const handleCompleteRequest = async (id) => {
    try {
      await axios.post(`${apiUrl}/requests/${id}/complete`, {}, { headers: { Authorization: `Bearer ${admin.token}` } });
      fetchData(admin.token);
    } catch (err) {
      console.error("Failed to complete request", err);
    }
  };

  const handleDeleteRequest = async (id) => {
    if (window.confirm("Are you sure you want to delete this request permanently?")) {
      try {
        await axios.delete(`${apiUrl}/requests/${id}`, { headers: { Authorization: `Bearer ${admin.token}` } });
        fetchData(admin.token);
      } catch (err) {
         console.error("Failed to delete request", err);
      }
    }
  };

  const handleDeleteCommunity = async (id) => {
     if (window.confirm("Permanently delete this community from the matrix?")) {
        try {
           await axios.delete(`${apiUrl}/communities/${id}`, { headers: { Authorization: `Bearer ${admin.token}` } });
           fetchData(admin.token);
        } catch (err) {
           console.error("Error deleting community", err);
        }
     }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  // derived metrics
  const totalUsers = users.length;
  const activeRequests = requests.filter(r => r.status && r.status !== 'COMPLETED').length;
  const completedTasks = requests.filter(r => r.status === 'COMPLETED').length;

  const chartData = [
    { name: 'Completed', value: completedTasks, color: '#00C49F' },
    { name: 'In Progress', value: requests.filter(r => r.status === 'IN_PROGRESS').length, color: '#FFBB28' },
    { name: 'Open', value: requests.filter(r => r.status === 'OPEN').length, color: '#FF8042' }
  ].filter(item => item.value > 0);

  return (
    <div className="container mt-4 pt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="text-gradient">Super Admin Dashboard</h2>
          <p className="text-light opacity-75 mb-0">Global Telemetry Hub</p>
        </div>
        <button onClick={handleLogout} className="neon-button-secondary">Logout Console</button>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="glass-card text-center py-4 h-100">
            <h1 className="display-4 fw-bold text-gradient">{totalUsers}</h1>
            <p className="text-muted mb-0 text-uppercase fw-semibold tracking-wide">Total Entities</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="glass-card text-center py-4 h-100">
            <h1 className="display-4 fw-bold text-gradient">{communities.length}</h1>
            <p className="text-muted mb-0 text-uppercase fw-semibold tracking-wide">Communities</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="glass-card text-center py-4 h-100">
            <h1 className="display-4 fw-bold text-info">{activeRequests}</h1>
            <p className="text-muted mb-0 text-uppercase fw-semibold tracking-wide">Active Threads</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="glass-card text-center py-4 h-100">
            <h1 className="display-4 fw-bold text-success">{completedTasks}</h1>
            <p className="text-muted mb-0 text-uppercase fw-semibold tracking-wide">Finished Operations</p>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-3">
            <div className="glass-card h-100 p-0 overflow-hidden">
               <div className="list-group list-group-flush border-0">
                  <button onClick={() => setActiveTab('requests')} className={`list-group-item list-group-item-action py-3 ${activeTab === 'requests' ? 'bg-primary text-white border-primary' : 'bg-transparent text-light'}`}>
                    <i className="bi bi-list-task me-2"></i> Requests Manager
                  </button>
                  <button onClick={() => setActiveTab('users')} className={`list-group-item list-group-item-action py-3 ${activeTab === 'users' ? 'bg-primary text-white border-primary' : 'bg-transparent text-light'}`}>
                    <i className="bi bi-people me-2"></i> Resident Reports
                  </button>
                  <button onClick={() => setActiveTab('communities')} className={`list-group-item list-group-item-action py-3 ${activeTab === 'communities' ? 'bg-primary text-white border-primary' : 'bg-transparent text-light'}`}>
                    <i className="bi bi-collection me-2"></i> Network Map
                  </button>
                  <button onClick={() => setActiveTab('profile')} className={`list-group-item list-group-item-action py-3 ${activeTab === 'profile' ? 'bg-primary text-white border-primary' : 'bg-transparent text-light'}`}>
                    <i className="bi bi-person-badge-fill me-2"></i> Profile Setup
                  </button>
               </div>
               
               <div className="p-3 mt-3 border-top border-secondary">
                  <h6 className="text-muted mb-3 text-uppercase text-center small">System Distribution</h6>
                  {chartData.length > 0 ? (
                    <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer>
                        <PieChart>
                            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#333', color: '#fff', borderRadius: '8px' }} itemStyle={{color: '#fff'}} />
                        </PieChart>
                        </ResponsiveContainer>
                    </div>
                  ) : <div className="text-center text-muted small py-4">No data to display</div>}
               </div>
            </div>
        </div>

        <div className="col-lg-9">
          <div className="glass-card h-100">
            {activeTab === 'requests' && (
                <>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="mb-0">Global Command Queue</h4>
                  <button onClick={() => fetchData(admin.token)} className="neon-button-secondary btn-sm">Refresh Stream</button>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table className="table table-borderless text-light align-middle custom-glass-table">
                    <thead className="position-sticky top-0 bg-dark" style={{zIndex: 1}}>
                      <tr className="text-muted border-bottom border-light border-opacity-10">
                        <th scope="col" className="pb-3 fw-medium">Title</th>
                        <th scope="col" className="pb-3 fw-medium">State</th>
                        <th scope="col" className="pb-3 fw-medium">Context (Comm.)</th>
                        <th scope="col" className="pb-3 fw-medium text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.length > 0 ? requests.map(req => (
                        <tr key={req.id} className="border-bottom border-light border-opacity-10">
                          <td className="py-3"><div className="fw-semibold">{req.title}</div><div className="small text-muted">Author: {req.author?.name || 'Ghost'}</div></td>
                          <td className="py-3">
                            <span className={`badge rounded-pill px-3 py-2 ${req.status === 'COMPLETED' ? 'bg-success bg-opacity-25 text-success border border-success' : 'bg-warning bg-opacity-25 text-warning border border-warning'}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3">{req.community?.name || <span className="fst-italic text-muted">Unknown</span>}</td>
                          <td className="py-3 text-end">
                            <div className="btn-group">
                              {req.status !== 'COMPLETED' && <button onClick={() => handleCompleteRequest(req.id)} className="btn btn-sm btn-outline-success rounded-pill px-3 me-2">Complete</button>}
                              <button onClick={() => handleDeleteRequest(req.id)} className="btn btn-sm btn-outline-danger rounded-pill px-3">Purge</button>
                            </div>
                          </td>
                        </tr>
                      )) : <tr><td colSpan="4" className="text-center py-4 text-muted">No requests found.</td></tr>}
                    </tbody>
                  </table>
                </div>
                </>
            )}

            {activeTab === 'users' && (
                <>
                <h4 className="mb-4 text-info fw-bold"><i className="bi bi-file-earmark-bar-graph-fill me-2"></i>Global Metric Reports</h4>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table className="table table-borderless text-light align-middle custom-glass-table">
                    <thead className="position-sticky top-0 bg-dark" style={{zIndex: 1}}>
                      <tr className="text-muted border-bottom border-light border-opacity-10 align-middle">
                        <th scope="col" className="pb-3 fw-medium">Entity Name / Role</th>
                        <th scope="col" className="pb-3 fw-medium text-center">Requests Posted</th>
                        <th scope="col" className="pb-3 fw-medium text-center">Bounties Completed</th>
                        <th scope="col" className="pb-3 fw-medium text-center">Open Liability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length > 0 ? users.map(u => {
                          const postedLen = requests.filter(r => r.author?.id === u.id).length;
                          const completedLen = requests.filter(r => r.volunteer?.id === u.id && r.status === 'COMPLETED').length;
                          const liabLen = requests.filter(r => r.volunteer?.id === u.id && r.status !== 'COMPLETED').length;

                          return (
                            <tr key={u.id} className="border-bottom border-light border-opacity-10">
                              <td className="py-3">
                                  <div className="fw-semibold">{u.name}</div>
                                  <div className="small text-muted">{u.email}</div>
                                  <span className={`badge px-2 py-1 mt-1 ${u.role === 'ADMIN' ? 'bg-danger bg-opacity-25 text-danger' : 'bg-primary bg-opacity-25 text-primary'}`}>{u.role}</span>
                              </td>
                              <td className="py-3 text-center fs-5 text-light">{postedLen}</td>
                              <td className="py-3 text-center fs-5 fw-bold text-success">{completedLen}</td>
                              <td className="py-3 text-center fs-5 text-warning">{liabLen}</td>
                            </tr>
                          );
                      }) : <tr><td colSpan="4" className="text-center py-4 text-muted">No resident data available.</td></tr>}
                    </tbody>
                  </table>
                </div>
                </>
            )}

            {activeTab === 'communities' && (
                <>
                  <h4 className="mb-4">Global Network Map</h4>
                  <div className="list-group bg-transparent">
                      {communities.length > 0 ? communities.map(c => (
                          <div key={c.id} className="list-group-item bg-dark bg-opacity-50 text-light border-secondary mb-2 rounded d-flex justify-content-between align-items-center p-3">
                              <div>
                                  <h6 className="fw-bold mb-1">{c.name} {c.isPrivate && <span className="badge bg-danger ms-2"><i className="bi bi-lock-fill"></i> System Locked</span>}</h6>
                                  <p className="small text-muted mb-0">{c.description}</p>
                              </div>
                              <div className="d-flex align-items-center gap-3">
                                  <span className="badge bg-secondary">{c.members?.length || 0} Entities Enrolled</span>
                                  <button onClick={() => handleDeleteCommunity(c.id)} className="btn btn-sm btn-outline-danger shadow-sm"><i className="bi bi-trash"></i> Dismantle Matrix</button>
                              </div>
                          </div>
                      )) : <div className="text-muted">No mapped coordinates.</div>}
                  </div>
                </>
            )}

            {activeTab === 'profile' && profileData && (
                <div className="p-2">
                    <h4 className="mb-4 text-gradient">Super Admin Identity</h4>
                    <div className="row g-4">
                        <div className="col-md-7">
                            <form onSubmit={handleUpdateProfile} className="p-4 border border-secondary rounded overflow-hidden shadow-sm" style={{background: 'rgba(0,0,0,0.3)'}}>
                                <h6 className="text-muted mb-3 text-uppercase">Root Authorization Config</h6>
                                <input type="text" value={profileEdit.name} onChange={e=>setProfileEdit({...profileEdit, name:e.target.value})} className="form-control bg-dark border-secondary text-light mb-3" required />
                                <input type="email" value={profileEdit.email} onChange={e=>setProfileEdit({...profileEdit, email:e.target.value})} className="form-control bg-dark border-secondary text-light mb-4" required />
                                <button type="submit" className="neon-button-secondary w-100 py-2">Update Identity Payload</button>
                            </form>
                        </div>
                        <div className="col-md-5">
                            <div className="p-4 border border-info rounded h-100" style={{background: 'rgba(23, 162, 184, 0.05)'}}>
                                <h6 className="text-info mb-3">Admin Security Badges</h6>
                                <div className="d-flex flex-wrap gap-2">
                                    <span className="badge bg-danger text-light px-3 py-2 fs-6 rounded-pill border border-danger shadow-sm"><i className="bi bi-shield-lock-fill me-2"></i>Root Access Grant</span>
                                    <span className="badge bg-primary text-light px-3 py-2 fs-6 rounded-pill border border-primary shadow-sm"><i className="bi bi-eye-fill me-2"></i>Global Sight</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
