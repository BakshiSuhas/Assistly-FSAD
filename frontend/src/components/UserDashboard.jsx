import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RequestMap from './RequestMap';

const UserDashboard = () => {
  const [user, setUser] = useState({ id: null, name: 'User', role: 'User', token: '' });
  const [requests, setRequests] = useState([]);
  const [communities, setCommunities] = useState([]);
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'communities' | 'profile' | 'admin_manage'
  const [activeAdminComm, setActiveAdminComm] = useState(null); // The community the admin is managing
  const [selectedCommunityId, setSelectedCommunityId] = useState(null); // For viewing requests contextually

  const [isVolunteerMode, setIsVolunteerMode] = useState(false);
  const navigate = useNavigate();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '', latitude: 40.7128, longitude: -74.0060 });
  const [loading, setLoading] = useState(false);
  
  const apiUrl = 'http://localhost:8080/api';

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
        fetchCommunities(parsed.token);
      } catch (err) {
        console.error('Error parsing user data', err);
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (communities.length > 0 && !selectedCommunityId) {
      const firstJoined = communities.find(c => c.members?.some(m => m.id === user.id) || c.admin?.id === user.id);
      if (firstJoined) {
        setSelectedCommunityId(firstJoined.id);
      }
    }
  }, [communities, user.id, selectedCommunityId]);

  useEffect(() => {
    if (selectedCommunityId && user.token) {
      fetchRequests(user.token, selectedCommunityId);
    }
  }, [selectedCommunityId, user.token]);

  const fetchRequests = async (token, commId) => {
    if (!commId) return;
    try {
      const res = await axios.get(`${apiUrl}/requests/community/${commId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data);
    } catch (err) {
      if (err.response?.status !== 403) {
         console.error("Failed to fetch requests", err);
      }
    }
  };

  const fetchCommunities = async (token) => {
    try {
      const res = await axios.get(`${apiUrl}/communities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommunities(res.data);
    } catch (err) {
      console.error('Failed to fetch communities', err);
    }
  };

  const toggleMode = async () => {
    setIsVolunteerMode(!isVolunteerMode);
  };

  const handleJoinCommunity = async (id) => {
    try {
      await axios.post(`${apiUrl}/communities/${id}/join`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      fetchCommunities(user.token);
    } catch (err) {
      alert(err.response?.data || "Failed to join");
    }
  };

  const handleAdminAction = async (commId, userId, actionType) => {
    try {
       // actionType: approve, reject, remove
       if (actionType === 'remove') {
           if (!window.confirm("Remove this member?")) return;
           await axios.delete(`${apiUrl}/communities/${commId}/members/${userId}`, {
               headers: { Authorization: `Bearer ${user.token}` }
           });
       } else {
           await axios.post(`${apiUrl}/communities/${commId}/members/${userId}/${actionType}`, {}, {
               headers: { Authorization: `Bearer ${user.token}` }
           });
       }
       fetchCommunities(user.token);
       // Sync local admin state securely
       const res = await axios.get(`${apiUrl}/communities`, { headers: { Authorization: `Bearer ${user.token}` } });
       const updatedComm = res.data.find(c => c.id === commId);
       setActiveAdminComm(updatedComm);
    } catch (err) {
       alert(err.response?.data || `Failed to ${actionType} user`);
    }
  };

  const handleVerifyAction = async (id, action) => {
    try {
      await axios.post(`${apiUrl}/requests/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      fetchRequests(user.token, selectedCommunityId);
    } catch (err) {
      alert(err.response?.data || `Unable to ${action} request at this time.`);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!selectedCommunityId) {
        alert("Select a workspace community from the dashboard context tab first!");
        return;
    }
    setLoading(true);
    try {
        await axios.post(`${apiUrl}/requests/community/${selectedCommunityId}`, formData, { headers: { Authorization: `Bearer ${user.token}` } });
        setShowModal(false);
        setFormData({ title: '', description: '', latitude: 40.7128, longitude: -74.0060 });
        fetchRequests(user.token, selectedCommunityId);
    } catch {
      alert("Error saving strictly-bound request context.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const displayedRequests = requests.filter(req => {
    if (isVolunteerMode) return req.author?.id !== user.id;
    return req.author?.id === user.id;
  });

  return (
    <div className="container mt-4 pt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-gradient">Welcome, {user.name}</h2>
        </div>
        <div className="d-flex gap-3 align-items-center">
          <div className="form-check form-switch ps-0 d-flex align-items-center gap-2">
            <span className={`small fw-bold ${!isVolunteerMode ? 'text-gradient' : 'text-muted'}`}>RESIDENT</span>
            <input className="form-check-input ms-0 mt-0" type="checkbox" role="switch" checked={isVolunteerMode} onChange={toggleMode} style={{width: '3em', height: '1.5em', cursor: 'pointer'}} />
            <span className={`small fw-bold ${isVolunteerMode ? 'text-info' : 'text-muted'}`}>VOLUNTEER</span>
          </div>
          <button onClick={handleLogout} className="neon-button-secondary py-1 px-3">Logout</button>
        </div>
      </div>

      <div className="row g-4">
        {/* Sidebar */}
        <div className="col-lg-3">
          <div className="glass-card h-100 d-flex flex-column align-items-center py-4">
            <div className="rounded-circle bg-secondary mb-3 d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px', fontSize: '1.8rem' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h5 className="fw-bold text-center">{user.name}</h5>
            <span className="badge bg-primary bg-opacity-25 text-primary border border-primary rounded-pill px-3 py-1 mb-4">{user.role}</span>
            <div className="d-flex flex-column gap-2 w-100 px-2 mt-auto">
              <button disabled={!selectedCommunityId} onClick={() => { setShowModal(true); }} className="btn btn-outline-light rounded-pill w-100">
                <i className="bi bi-plus-circle me-2"></i> New Request
              </button>
              <button onClick={() => setActiveTab('dashboard')} className={`btn rounded-pill w-100 mt-3 ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline-secondary'}`}>
                Workspace
              </button>
              <button onClick={() => setActiveTab('communities')} className={`btn rounded-pill w-100 ${activeTab === 'communities' ? 'btn-primary' : 'btn-outline-secondary'}`}>
                Community Network
              </button>
              <button onClick={() => setActiveTab('profile')} className={`btn rounded-pill w-100 ${activeTab === 'profile' ? 'btn-primary' : 'btn-outline-secondary'}`}>
                Profile Hub
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-lg-9">
          {activeTab === 'dashboard' ? (
            <div className="glass-card h-100">
              <div className="d-flex justify-content-between mb-4 align-items-center">
                  <h4 className="mb-0">{isVolunteerMode ? 'Global Assignments' : 'My Requests'}</h4>
                  <select className="form-select bg-dark text-light border-secondary w-50" value={selectedCommunityId || ''} onChange={(e) => setSelectedCommunityId(Number(e.target.value))}>
                      <option value="" disabled>Select Context Workspace...</option>
                      {communities.filter(c => c.members?.some(m => m.id === user.id) || c.admin?.id === user.id).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
              </div>

              {selectedCommunityId ? (
                <>
                  <div className="table-responsive mb-4" style={{maxHeight: '300px'}}>
                    <table className="table table-borderless text-light align-middle custom-glass-table">
                      <thead className="position-sticky top-0 bg-dark" style={{zIndex: 1}}>
                        <tr className="text-muted border-bottom border-light border-opacity-10">
                          <th scope="col" className="pb-3 fw-medium">Mission Title</th>
                          <th scope="col" className="pb-3 fw-medium text-center">State Status</th>
                          <th scope="col" className="pb-3 fw-medium text-end">Action Interface</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRequests.length > 0 ? displayedRequests.map(req => (
                          <tr key={req.id} className="border-bottom border-light border-opacity-10">
                            <td className="py-3">
                              <div className="fw-bold">{req.title}</div>
                              <div className="small text-muted text-truncate" style={{maxWidth: '250px'}}>{req.description}</div>
                            </td>
                            <td className="py-3 text-center">
                              <span className={`badge rounded-pill px-3 py-2 ${req.status === 'COMPLETED' ? 'bg-success bg-opacity-25 text-success border border-success' : req.status === 'IN_PROGRESS' ? 'bg-info bg-opacity-25 text-info border border-info' : req.status === 'PENDING_VERIFICATION' ? 'bg-warning bg-opacity-25 text-warning border border-warning' : 'bg-primary bg-opacity-25 text-primary border border-primary'}`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 text-end">
                              {isVolunteerMode ? (
                                <>
                                  {req.status === 'OPEN' && (
                                    <button className="btn btn-sm btn-outline-info rounded-pill px-3">Enlist Volunteer</button>
                                  )}
                                  {req.status === 'IN_PROGRESS' && (
                                    <button onClick={() => handleVerifyAction(req.id, 'submit')} className="btn btn-sm btn-info rounded-pill px-3 text-dark fw-bold">Submit Validation Payload</button>
                                  )}
                                </>
                              ) : (
                                <>
                                  {req.status === 'PENDING_VERIFICATION' && (
                                    <>
                                      <button onClick={() => handleVerifyAction(req.id, 'complete')} className="btn btn-sm btn-success rounded-pill px-3 me-2">Verify</button>
                                      <button onClick={() => handleVerifyAction(req.id, 'reject')} className="btn btn-sm btn-danger rounded-pill px-3">Intercept</button>
                                    </>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="3" className="text-center py-4 text-muted">No secure assignments in this block.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h5 className="mb-3 border-top border-secondary pt-4">Workspace Area Map</h5>
                  <div className="w-100 rounded bg-dark border border-light border-opacity-10">
                    <RequestMap requests={displayedRequests} currentUserId={user.id} />
                  </div>
                </>
              ) : (
                  <div className="text-center py-5 text-muted">Acknowledge a community block to synchronize payload context.</div>
              )}
            </div>
          ) : activeTab === 'communities' ? (
            <div className="glass-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                 <div>
                   <h4 className="mb-0">Global Syndicate Architecture</h4>
                 </div>
                 <div style={{width: '250px'}}>
                   <input type="text" className="form-control bg-dark text-light border-secondary rounded-pill" placeholder="Scan matrices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
              </div>
              <div className="row g-3">
                {communities.map(comm => {
                   const isMember = comm.members?.some(m => m.id === user.id);
                   const isPending = comm.pendingMembers?.some(m => m.id === user.id);
                   const isAdmin = comm.admin?.id === user.id;

                   return (
                     <div key={comm.id} className="col-md-6">
                       <div className="p-3 border border-secondary rounded bg-dark bg-opacity-50 h-100 d-flex flex-column">
                         <div className="d-flex justify-content-between align-items-center mb-2">
                             <h5 className="fw-bold text-gradient mb-0">{comm.name}</h5>
                             {comm.isPrivate && <span className="badge bg-danger bg-opacity-25 text-danger px-2"><i className="bi bi-lock-fill"></i> Priv</span>}
                         </div>
                         <p className="small text-muted flex-grow-1">{comm.description}</p>
                         <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary">
                           <span className="small badge bg-secondary bg-opacity-25 text-light">{comm.members?.length || 0} Members</span>
                           <div className="d-flex gap-2">
                               {isAdmin ? (
                                   <button onClick={() => { setActiveAdminComm(comm); setActiveTab('admin_manage'); }} className="btn btn-sm btn-warning rounded-pill px-3 fw-bold text-dark"><i className="bi bi-shield-lock-fill"></i> Admin Console</button>
                               ) : isPending ? (
                                   <button disabled className="btn btn-sm btn-secondary rounded-pill px-3 disabled">Awaiting Approval</button>
                               ) : (
                                   <button onClick={() => handleJoinCommunity(comm.id)} disabled={isMember} className={`btn btn-sm rounded-pill px-4 ${isMember ? 'btn-outline-secondary' : 'btn-info text-dark fw-bold'}`}>
                                     {isMember ? 'Joined' : 'Initiate Handshake'}
                                   </button>
                               )}
                           </div>
                         </div>
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          ) : activeTab === 'admin_manage' && activeAdminComm ? (
            <div className="glass-card h-100 p-4">
              <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary pb-3">
                 <h4 className="mb-0 text-warning"><i className="bi bi-shield-lock-fill me-2"></i>Admin Console: <span className="text-light">{activeAdminComm.name}</span></h4>
                 <button onClick={() => setActiveTab('communities')} className="btn btn-sm btn-outline-light rounded-pill px-3">Close Console</button>
              </div>

              <h5 className="text-info mb-3">Pending Authorization Queue ({activeAdminComm.pendingMembers?.length || 0})</h5>
              <div className="table-responsive mb-5 border border-secondary rounded">
                  <table className="table table-borderless text-light align-middle mb-0 bg-dark">
                      <tbody>
                          {activeAdminComm.pendingMembers?.length > 0 ? activeAdminComm.pendingMembers.map(m => (
                              <tr key={m.id} className="border-bottom border-secondary">
                                  <td className="ps-3"><div className="fw-bold">{m.name}</div><div className="small text-muted">{m.email}</div></td>
                                  <td className="text-end pe-3">
                                      <button onClick={() => handleAdminAction(activeAdminComm.id, m.id, 'approve')} className="btn btn-sm btn-success rounded-pill px-3 me-2">Authorize</button>
                                      <button onClick={() => handleAdminAction(activeAdminComm.id, m.id, 'reject')} className="btn btn-sm btn-outline-danger rounded-pill px-3">Decline</button>
                                  </td>
                              </tr>
                          )) : <tr><td className="text-center py-4 text-muted fst-italic">Queue is empty.</td></tr>}
                      </tbody>
                  </table>
              </div>

              <h5 className="text-light mb-3">Current Validated Members</h5>
              <div className="table-responsive border border-secondary rounded overflow-hidden">
                  <table className="table table-borderless text-light align-middle mb-0 bg-dark bg-opacity-50">
                      <tbody>
                          {activeAdminComm.members?.map(m => (
                              <tr key={m.id} className="border-bottom border-light border-opacity-10">
                                  <td className="ps-3"><div className="fw-bold">{m.name} {m.id === user.id && <span className="badge bg-warning text-dark ms-2">Admin</span>}</div></td>
                                  <td className="text-end pe-3">
                                      {m.id !== user.id && <button onClick={() => handleAdminAction(activeAdminComm.id, m.id, 'remove')} className="btn btn-sm btn-outline-danger rounded-pill px-3 mt-1">Revoke Access</button>}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1050}}>
          <div className="glass-card animate-fade-in mx-3 p-4" style={{width: '600px'}}>
            <h4 className="text-gradient mb-4">Initialize Block Request</h4>
            <form onSubmit={handleCreateRequest}>
              <div className="mb-3">
                <input required type="text" className="form-control bg-dark border-secondary text-light" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Directive Title..." />
              </div>
              <div className="mb-4">
                <textarea required className="form-control bg-dark border-secondary text-light" rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Payload Description..."></textarea>
              </div>
              <div className="d-flex justify-content-end gap-3 mt-4 pt-3 border-top border-secondary">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline-secondary rounded-pill px-4">Cancel</button>
                <button type="submit" disabled={loading} className="neon-button px-5">{loading ? 'Processing...' : 'Broadcast'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserDashboard;
