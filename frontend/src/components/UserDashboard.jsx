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
  const [pulse, setPulse] = useState({ events: [], meetings: [], rules: [] });

  const [isVolunteerMode, setIsVolunteerMode] = useState(false);
  const navigate = useNavigate();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showCreateCommModal, setShowCreateCommModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({ title: '', description: '', latitude: 40.7128, longitude: -74.0060 });
  const [commFormData, setCommFormData] = useState({ name: '', description: '', isPrivate: false });
  const [profileData, setProfileData] = useState(null);
  
  const apiUrl = 'http://localhost:8080/api';

  const normalizeId = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const sameId = (a, b) => {
    const left = normalizeId(a);
    const right = normalizeId(b);
    return left !== null && right !== null && left === right;
  };

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
    // Proactive selection: If we have communities and none is selected, pick the first one joined
    if (communities.length > 0 && !selectedCommunityId) {
      const joinedComm = communities.find(c => 
        c.members?.some(m => sameId(m.id, user.id)) || 
        sameId(c.admin?.id, user.id)
      );
      if (joinedComm) {
        console.log("SYNC: Auto-transitioning to Community Context:", joinedComm.name);
        setSelectedCommunityId(joinedComm.id);
      }
    }
  }, [communities, user.id, selectedCommunityId]);

  // Keep selectedCommunityId valid if communities change
  useEffect(() => {
    if (selectedCommunityId && communities.length > 0) {
        const stillExists = communities.find(c => sameId(c.id, selectedCommunityId));
        if (!stillExists) {
            setSelectedCommunityId(null);
        }
    }
  }, [communities, selectedCommunityId]);

  useEffect(() => {
    if (selectedCommunityId && user.token) {
      fetchRequests(user.token, selectedCommunityId);
      fetchCommunityPulse(user.token, selectedCommunityId);
    }
  }, [selectedCommunityId, user.token]);

  const fetchCommunityPulse = async (token, commId) => {
    try {
      const res = await axios.get(`${apiUrl}/content/pulse/${commId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPulse(res.data);
    } catch (err) {
      console.error("Failed to fetch community pulse", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile' && user.token) {
      fetchProfile(user.token);
    }
  }, [activeTab, user.token]);

  const fetchProfile = async (token) => {
    try {
      const res = await axios.get(`${apiUrl}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfileData(res.data);
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

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
    } catch (err) {
      const message = err.response?.data || "Unable to create request right now.";
      alert(typeof message === 'string' ? message : "Unable to create request right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        await axios.post(`${apiUrl}/communities`, commFormData, { headers: { Authorization: `Bearer ${user.token}` } });
        setShowCreateCommModal(false);
        setCommFormData({ name: '', description: '', isPrivate: false });
        fetchCommunities(user.token);
    } catch (err) {
      alert(err.response?.data || "Unable to create community.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const userJoinedCommunities = communities.filter(c => 
    c.members?.some(m => sameId(m.id, user.id)) || 
    sameId(c.admin?.id, user.id)
  );

  const displayedRequests = requests.filter(req => {
    if (isVolunteerMode) return !sameId(req.author?.id, user.id);
    return sameId(req.author?.id, user.id);
  });

  return (
    <div className="container mt-4 pt-4 mb-5 animate-in">
      <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-4 px-2">
        <div>
          <h2 className="accent-gradient fw-bold mb-1" style={{ fontSize: '2.5rem' }}>Welcome, {user.name}</h2>
          <p className="text-muted small text-uppercase tracking-widest">Protocol Status: Secure / Neural Link Active</p>
        </div>
        <div className="d-flex gap-4 align-items-center">
          <div className="form-check form-switch ps-0 d-flex align-items-center gap-3 bg-dark bg-opacity-50 px-4 py-2 rounded-pill border border-secondary border-opacity-25">
            <span className={`small fw-bold tracking-wider ${!isVolunteerMode ? 'text-primary' : 'text-muted opacity-50'}`}>RESIDENT</span>
            <input className="form-check-input ms-0 mt-0" type="checkbox" role="switch" checked={isVolunteerMode} onChange={toggleMode} style={{width: '2.8rem', height: '1.4rem', cursor: 'pointer', backgroundColor: 'var(--bg-dark-700)', borderColor: 'var(--glass-border)'}} />
            <span className={`small fw-bold tracking-wider ${isVolunteerMode ? 'text-secondary' : 'text-muted opacity-50'}`}>VOLUNTEER</span>
          </div>
          <button onClick={handleLogout} className="class-btn class-btn-secondary py-2 px-4 shadow-none small fw-bold">Terminate Session</button>
        </div>
      </div>

      <div className="row g-5">
        {/* Sidebar */}
        <div className="col-lg-3">
          <div className="premium-glass h-100 d-flex flex-column align-items-center py-5 px-3">
            <div className="rounded-circle bg-primary bg-opacity-10 mb-4 d-flex align-items-center justify-content-center text-primary shadow-lg" style={{ width: '100px', height: '100px', fontSize: '2.5rem', border: '2px solid var(--primary-glow)' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h5 className="fw-bold text-center mb-1">{user.name}</h5>
            <span className="class-badge badge-open mb-5" style={{ fontSize: '0.65rem' }}>{user.role}</span>
            
            <div className="d-flex flex-column gap-2 w-100 mt-2">
              <button 
                onClick={() => { 
                  if (!selectedCommunityId) {
                    const firstJoined = communities.find(c => c.members?.some(m => sameId(m.id, user.id)) || sameId(c.admin?.id, user.id));
                    if (firstJoined) {
                      setSelectedCommunityId(firstJoined.id);
                      setShowModal(true);
                    } else {
                      setActiveTab('communities');
                      alert("Community Protocol: Join a Network first to broadcast missions.");
                    }
                  } else {
                    setShowModal(true); 
                  }
                }} 
                className="class-btn w-100 justify-content-center mb-4 py-3"
              >
                <i className="bi bi-plus-circle-fill"></i> New Directive
              </button>
              
              <button onClick={() => setActiveTab('dashboard')} className={`sidebar-link w-100 border-0 ${activeTab === 'dashboard' ? 'active' : ''}`}>
                <i className="bi bi-grid-1x2-fill"></i> Operational Workspace
              </button>
              <button onClick={() => setActiveTab('communities')} className={`sidebar-link w-100 border-0 ${activeTab === 'communities' ? 'active' : ''}`}>
                <i className="bi bi-people-fill"></i> Community Networks
              </button>
              <button onClick={() => setActiveTab('profile')} className={`sidebar-link w-100 border-0 ${activeTab === 'profile' ? 'active' : ''}`}>
                <i className="bi bi-person-circle"></i> Neural Profile
              </button>
            </div>

            <div className="mt-auto pt-5 w-100 px-3">
               <div className="p-3 rounded-4 bg-primary bg-opacity-5 border border-primary border-opacity-10 text-center">
                  <div className="text-muted small mb-1" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>SYSTEM VERSION</div>
                  <div className="mono text-primary small fw-bold">v2.4.0-STABLE</div>
               </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-lg-9">
          {activeTab === 'dashboard' ? (
            <div className="premium-glass h-100 p-5">
              <div className="d-flex justify-content-between mb-5 align-items-center">
                  <div>
                    <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem' }}>{isVolunteerMode ? 'Global Assignments' : 'My Deployment Log'}</h4>
                    <p className="text-muted small">Real-time tactical overview of community needs.</p>
                  </div>
                  <div className="d-flex gap-3 align-items-center w-50 justify-content-end">
                    <select className="class-input py-2" style={{ maxWidth: '250px' }} value={selectedCommunityId || ''} onChange={(e) => setSelectedCommunityId(Number(e.target.value))}>
                        <option value="" disabled>Select Workspace...</option>
                          {userJoinedCommunities.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
              </div>

              {!selectedCommunityId && userJoinedCommunities.length === 0 && (
                <div className="text-center py-5">
                   <div className="mb-5">
                      <i className="bi bi-geo-alt-fill accent-gradient" style={{fontSize: '5rem', filter: 'drop-shadow(0 0 20px var(--primary-glow))'}}></i>
                   </div>
                   <h2 className="fw-bold mb-4" style={{ fontSize: '2rem' }}>Operations Center Inactive</h2>
                   <p className="text-muted lead mb-5 mx-auto opacity-75" style={{maxWidth: '600px', fontSize: '1.1rem'}}>
                      Your tactical status is currently offline. To begin broadcasting missions or volunteering for active assignments, you must first connect with a Community Network.
                   </p>
                   <button 
                     onClick={() => setActiveTab('communities')} 
                     className="class-btn px-5 py-3"
                   >
                     Initialize Network Link
                   </button>
                </div>
              )}

              {selectedCommunityId && (
                <div className="row g-4 mb-5">
                  <div className="col-md-4">
                    <div className="p-4 premium-glass border-0 bg-opacity-10 text-center" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                      <div className="small text-muted mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Active Missions</div>
                      <div className="h2 fw-bold text-primary mb-0 mono">{requests.filter(r => r.status === 'IN_PROGRESS' || r.status === 'OPEN').length}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-4 premium-glass border-0 bg-opacity-10 text-center" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                      <div className="small text-muted mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Validation Queue</div>
                      <div className="h2 fw-bold text-accent mb-0 mono">{requests.filter(r => r.status === 'PENDING_VERIFICATION').length}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-4 premium-glass border-0 bg-opacity-10 text-center" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                      <div className="small text-muted mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Success Rate</div>
                      <div className="h2 fw-bold text-secondary mb-0 mono">{requests.filter(r => r.status === 'COMPLETED').length}</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedCommunityId ? (
                <>
                  <div className="row g-5 mb-5">
                    {/* Community Pulse Widget */}
                    <div className="col-lg-8">
                       <div className="p-5 rounded-4 premium-glass h-100" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)' }}>
                          <h5 className="text-primary mb-5 d-flex align-items-center fw-bold text-uppercase tracking-widest" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-activity me-3 fs-4"></i> Community Pulse
                          </h5>
                          <div className="row g-5">
                             <div className="col-md-6 border-end border-white border-opacity-5">
                                <h6 className="small text-muted mb-4 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.65rem' }}>Operational Gatherings</h6>
                                {pulse.events.length > 0 ? pulse.events.map(ev => (
                                  <div key={ev.id} className="mb-4 p-3 rounded-4 transition-all" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="fw-bold small mb-1">{ev.title}</div>
                                    <div className="text-muted" style={{ fontSize: '0.7rem' }}><i className="bi bi-calendar-event me-2 text-primary"></i> {new Date(ev.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                  </div>
                                )) : <div className="small text-muted fst-italic opacity-50">No active gatherings detected.</div>}
                             </div>
                             <div className="col-md-6">
                                <h6 className="small text-muted mb-4 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.65rem' }}>Tactical Sync-ups</h6>
                                {pulse.meetings.length > 0 ? pulse.meetings.map(mt => (
                                  <div key={mt.id} className="mb-4 p-3 rounded-4 transition-all" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="fw-bold small mb-2">{mt.title}</div>
                                    <a href={mt.link} target="_blank" rel="noreferrer" className="class-btn btn-sm py-1 px-3" style={{ fontSize: '0.65rem' }}><i className="bi bi-link-45deg me-1"></i> JOIN LINK</a>
                                  </div>
                                )) : <div className="small text-muted fst-italic opacity-50">No secure syncs scheduled.</div>}
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Governance Widget */}
                    <div className="col-lg-4">
                       <div className="p-5 rounded-4 premium-glass h-100" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(255,255,255,0) 100%)' }}>
                          <h5 className="text-accent mb-5 d-flex align-items-center fw-bold text-uppercase tracking-widest" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-shield-check me-3 fs-4"></i> Protocols
                          </h5>
                          <ul className="list-unstyled mb-0">
                             {pulse.rules.length > 0 ? pulse.rules.map(rule => (
                               <li key={rule.id} className="small mb-4 d-flex gap-3 align-items-start">
                                  <i className="bi bi-check2-circle text-accent mt-1"></i>
                                  <span className="opacity-75">{rule.description}</span>
                               </li>
                             )) : <li className="small text-muted fst-italic opacity-50">Protocols pending update.</li>}
                          </ul>
                       </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-4 mt-5">
                    <h5 className="text-muted text-uppercase small tracking-widest fw-bold mb-0">Tactical Deployments</h5>
                    <div className="bg-white bg-opacity-5 px-3 py-1 rounded-pill small mono text-muted" style={{ fontSize: '0.65rem' }}>{displayedRequests.length} OPERATIONS DETECTED</div>
                  </div>
                  
                  <div className="premium-glass p-0 overflow-hidden mb-5">
                    <div className="table-responsive" style={{maxHeight: '400px'}}>
                      <table className="class-table mb-0">
                        <thead>
                          <tr>
                            <th scope="col">Mission Profile</th>
                            <th scope="col" className="text-center">State Status</th>
                            <th scope="col" className="text-end">Command Interface</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedRequests.length > 0 ? displayedRequests.map(req => (
                            <tr key={req.id}>
                              <td className="py-4">
                                <div className="fw-bold mb-1 opacity-90">{req.title}</div>
                                <div className="small text-muted text-truncate" style={{maxWidth: '300px'}}>{req.description}</div>
                              </td>
                              <td className="py-4 text-center">
                                <span className={`class-badge ${req.status === 'COMPLETED' ? 'badge-done' : req.status === 'OPEN' ? 'badge-open' : 'badge-progress'}`}>
                                  {req.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-4 text-end">
                                {isVolunteerMode ? (
                                  <>
                                    {req.status === 'OPEN' && (
                                      <button onClick={() => handleVerifyAction(req.id, 'accept')} className="class-btn btn-sm py-1 px-3" style={{ fontSize: '0.7rem' }}>Enlist Profile</button>
                                    )}
                                    {req.status === 'IN_PROGRESS' && req.volunteer?.id === user.id && (
                                      <button onClick={() => handleVerifyAction(req.id, 'submit')} className="class-btn btn-sm py-1 px-3 bg-secondary border-0 text-white" style={{ fontSize: '0.7rem' }}>Submit Data</button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {req.status === 'PENDING_VERIFICATION' && (
                                      <div className="d-flex gap-2 justify-content-end">
                                         <button onClick={() => handleVerifyAction(req.id, 'complete')} className="class-btn btn-sm py-2 px-3 bg-secondary border-0 text-white" style={{ fontSize: '0.7rem' }}>
                                           <i className="bi bi-check2 me-1"></i> Approve
                                         </button>
                                         <button onClick={() => handleVerifyAction(req.id, 'reject')} className="class-btn btn-sm py-2 px-3 bg-danger border-0 text-white" style={{ fontSize: '0.7rem' }}>
                                           <i className="bi bi-x-lg me-1"></i> Reject
                                         </button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan="3" className="text-center py-5 text-muted opacity-50">No tactical data found in this jurisdiction.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <h5 className="mb-4 text-muted text-uppercase small tracking-widest fw-bold mt-5">Intelligence Overlay (Mapping)</h5>
                  <div className="w-100 rounded-4 overflow-hidden border border-white border-opacity-5 shadow-lg">
                    <RequestMap requests={displayedRequests} currentUserId={user.id} />
                  </div>
                </>
              ) : (
                  <div className="text-center py-5 premium-glass bg-opacity-5 mt-5">
                    <i className="bi bi-hdd-network mb-4 d-block fs-1 opacity-25"></i>
                    <p className="text-muted">Intelligence protocol inactive. Link with a community network first.</p>
                  </div>
              )}
            </div>
          ) : activeTab === 'communities' ? (
            <div className="premium-glass h-100 p-5 shadow-lg">
              <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3">
                 <div>
                   <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem' }}>Global Community Architecture</h4>
                   <p className="text-muted small">Connect with active networks to expand your reach.</p>
                 </div>
                 <div className="d-flex gap-3">
                    <button onClick={() => setShowCreateCommModal(true)} className="class-btn btn-sm py-2 px-4 shadow-none small fw-bold">
                       <i className="bi bi-plus-lg me-1"></i> New Precinct
                    </button>
                    <div style={{width: '200px'}}>
                      <input type="text" className="class-input py-2" placeholder="Scan matrices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                 </div>
              </div>
              <div className="row g-4">
                {communities.map(comm => {
                   const isMember = comm.members?.some(m => sameId(m.id, user.id));
                   const isPending = comm.pendingMembers?.some(m => sameId(m.id, user.id));
                   const isAdmin = sameId(comm.admin?.id, user.id);

                   return (
                     <div key={comm.id} className="col-md-6">
                       <div className="p-4 premium-glass border-0 bg-opacity-5 h-100 d-flex flex-column transition-all hover-glow" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                         <div className="d-flex justify-content-between align-items-start mb-3">
                             <h6 className="fw-bold mb-0 opacity-90">{comm.name}</h6>
                             <div className="d-flex gap-1">
                                {comm.isPrivate && <span className="class-badge badge-progress px-2" style={{ fontSize: '0.55rem' }}>PRIVATE</span>}
                                {(isMember || isAdmin) && <span className="class-badge badge-done px-2" style={{ fontSize: '0.55rem' }}>CONNECTED</span>}
                             </div>
                         </div>
                         <p className="small text-muted flex-grow-1 mb-4 opacity-75" style={{ lineHeight: '1.6' }}>{comm.description}</p>
                         <div className="d-flex justify-content-between align-items-center mt-auto pt-3 border-top border-white border-opacity-5">
                           <span className="small text-muted mono" style={{ fontSize: '0.65rem' }}>{comm.members?.length || 0} OPERATIVES</span>
                           <div className="d-flex gap-2">
                               {isAdmin ? (
                                   <button onClick={() => { setActiveAdminComm(comm); setActiveTab('admin_manage'); }} className="btn btn-sm text-accent p-0 text-decoration-none small fw-bold tracking-widest" style={{ fontSize: '0.6rem' }}>ADMIN TERMINAL</button>
                               ) : isPending ? (
                                   <span className="small text-accent fst-italic mono" style={{ fontSize: '0.6rem' }}>LINKING...</span>
                               ) : (
                                   <button onClick={() => handleJoinCommunity(comm.id)} disabled={isMember} className={`class-btn border-0 py-1 px-3 shadow-none ${isMember ? 'bg-primary bg-opacity-10 text-primary' : 'bg-white bg-opacity-5 text-white'}`} style={{ fontSize: '0.6rem' }}>
                                     {isMember ? 'MEMBER' : 'ESTABLISH LINK'}
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
          ) : activeTab === 'profile' ? (
            <div className="premium-glass h-100 p-5 shadow-lg">
              <div className="d-flex align-items-center gap-5 mb-5 pb-5 border-bottom border-white border-opacity-5">
                <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary fw-bold p-1 shadow-lg" style={{ width: '130px', height: '130px', fontSize: '3.5rem', border: '3px solid var(--primary-glow)' }}>
                  <div className="bg-dark rounded-circle w-100 h-100 d-flex align-items-center justify-content-center">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div>
                  <h2 className="mb-2 accent-gradient fw-bold" style={{ fontSize: '2.5rem' }}>{user.name}</h2>
                  <p className="text-muted mb-4 fs-6 mono">{user.email || 'operator@matrix.assistly'}</p>
                  <div className="d-flex gap-3">
                    <span className="class-badge badge-open px-4 py-2">{user.role}</span>
                    {user.isVolunteer && <span className="class-badge badge-done px-3 py-2">ELITE OPERATIVE</span>}
                  </div>
                </div>
              </div>

              <div className="row g-4 mb-5">
                <div className="col-md-6">
                  <div className="p-5 premium-glass border-0 bg-opacity-5 text-center" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                    <div className="text-muted small mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.65rem' }}>Missions Deployed</div>
                    <div className="display-5 fw-bold accent-gradient mono">{profileData?.stats?.requestsPosted || 0}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-5 premium-glass border-0 bg-opacity-5 text-center" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                    <div className="text-muted small mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.65rem' }}>Impact Rating</div>
                    <div className="display-5 fw-bold text-secondary mono">{profileData?.stats?.requestsCompleted || 0}</div>
                  </div>
                </div>
              </div>

              <h5 className="mb-4 text-uppercase small tracking-widest text-muted fw-bold" style={{ fontSize: '0.75rem' }}>Verified Achievements</h5>
              <div className="d-flex flex-wrap gap-4">
                {profileData?.achievements?.length > 0 ? profileData.achievements.map((ach, idx) => (
                  <div key={idx} className="premium-glass p-3 px-4 d-flex align-items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                    <div className="text-accent p-2">
                        <i className="bi bi-patch-check-fill fs-5"></i>
                    </div>
                    <span className="fw-bold small opacity-75">{ach}</span>
                  </div>
                )) : (
                  <div className="text-center w-100 p-5 border border-dashed border-secondary border-opacity-25 rounded-4 text-muted small fst-italic opacity-50">
                    No active achievements detected. Complete missions to unlock community badges.
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'admin_manage' && activeAdminComm ? (
            <div className="premium-glass h-100 p-5 shadow-lg">
              <div className="d-flex justify-content-between align-items-center mb-5 border-bottom border-white border-opacity-5 pb-4">
                 <h4 className="mb-0 text-accent fw-bold"><i className="bi bi-shield-lock-fill me-3"></i>Admin Terminal: <span className="text-light">{activeAdminComm.name}</span></h4>
                 <button onClick={() => setActiveTab('communities')} className="class-btn class-btn-secondary py-1 px-4 small">Exit Console</button>
              </div>

              <h5 className="text-primary mb-4 fw-bold small text-uppercase tracking-widest">Authorization Queue ({activeAdminComm.pendingMembers?.length || 0})</h5>
              <div className="premium-glass overflow-hidden mb-5">
                  <table className="class-table mb-0">
                      <tbody>
                          {activeAdminComm.pendingMembers?.length > 0 ? activeAdminComm.pendingMembers.map(m => (
                              <tr key={m.id}>
                                  <td className="ps-4 py-4"><div className="fw-bold opacity-90">{m.name}</div><div className="small text-muted mono">{m.email}</div></td>
                                  <td className="text-end pe-4 py-4">
                                      <button onClick={() => handleAdminAction(activeAdminComm.id, m.id, 'approve')} className="class-btn btn-sm bg-secondary border-0 text-white px-4 me-2">Grant Access</button>
                                      <button onClick={() => handleAdminAction(activeAdminComm.id, m.id, 'reject')} className="class-btn btn-sm bg-danger border-0 text-white px-4">Decline</button>
                                  </td>
                              </tr>
                          )) : <tr><td className="text-center py-5 text-muted fst-italic opacity-50">Queue is currently clear.</td></tr>}
                      </tbody>
                  </table>
              </div>

              <h5 className="text-light mb-4 fw-bold small text-uppercase tracking-widest">Authorized Personnel</h5>
              <div className="premium-glass overflow-hidden">
                  <table className="class-table mb-0">
                      <tbody>
                          {activeAdminComm.members?.map(m => (
                              <tr key={m.id}>
                                  <td className="ps-4 py-4"><div className="fw-bold opacity-90">{m.name} {m.id === user.id && <span className="class-badge badge-progress ms-2" style={{ fontSize: '0.5rem' }}>Root Admin</span>}</div></td>
                                  <td className="text-end pe-4 py-4">
                                      {m.id !== user.id && <button onClick={() => handleAdminAction(activeAdminComm.id, m.id, 'remove')} className="class-btn btn-sm bg-danger border-0 text-white px-4">Revoke</button>}
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
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{backgroundColor: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(10px)', zIndex: 1050}}>
          <div className="premium-glass animate-in mx-3 p-5 shadow-2xl border-white border-opacity-5" style={{width: '680px'}}>
            <div className="d-flex justify-content-between align-items-center mb-5">
                <div>
                  <h4 className="accent-gradient fw-bold mb-1">Initialize Directive</h4>
                  <p className="text-muted small mb-0">Prepare payload for community broadcast.</p>
                </div>
                <div className="class-badge badge-open px-3">ENCRYPTED SYNC</div>
            </div>
            <form onSubmit={handleCreateRequest}>
              <div className="mb-4">
                <label className="small text-muted mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Directive Designation</label>
                <input required type="text" className="class-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Title of mission..." />
              </div>
              <div className="mb-4">
                <label className="small text-muted mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Payload Logistics</label>
                <textarea required className="class-input" rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detailed requirements..."></textarea>
              </div>
              <div className="mb-4">
                <label className="small text-muted mb-3 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Target Extraction Coordinates</label>
                <div className="rounded-4 border border-white border-opacity-5 overflow-hidden position-relative shadow-inner" style={{height: '260px'}}>
                  <RequestMap 
                    onLocationSelect={(lat, lng) => setFormData({...formData, latitude: lat, longitude: lng})} 
                    selectedLocation={{lat: formData.latitude, lng: formData.longitude}}
                    requests={[]}
                  />
                  <div className="position-absolute bottom-0 start-0 w-100 bg-dark bg-opacity-80 p-3 px-4 small border-top border-white border-opacity-5 d-flex justify-content-between animate-pulse">
                      <div><span className="text-muted small">LAT:</span> <span className="text-primary mono fw-bold">{formData.latitude.toFixed(6)}</span></div>
                      <div><span className="text-muted small">LNG:</span> <span className="text-primary mono fw-bold">{formData.longitude.toFixed(6)}</span></div>
                  </div>
                </div>
              </div>
              <div className="d-flex justify-content-end gap-3 mt-5 pt-4 border-top border-white border-opacity-5">
                <button type="button" onClick={() => setShowModal(false)} className="class-btn class-btn-secondary px-4">ABORT</button>
                <button type="submit" disabled={loading} className="class-btn px-5">{loading ? 'UPLOADING...' : 'BROADCAST DIRECTIVE'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateCommModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{backgroundColor: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(10px)', zIndex: 1050}}>
          <div className="premium-glass animate-in mx-3 p-5 shadow-2xl border-white border-opacity-5" style={{width: '540px'}}>
            <div className="mb-5">
              <h4 className="accent-gradient fw-bold mb-1">Establish New Precinct</h4>
              <p className="text-muted small mb-0">Define governance for a new community network.</p>
            </div>
            <form onSubmit={handleCreateCommunity}>
              <div className="mb-4">
                <label className="small text-muted mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Precinct Identifier</label>
                <input required type="text" className="class-input" value={commFormData.name} onChange={e => setCommFormData({...commFormData, name: e.target.value})} placeholder="Community Name..." />
              </div>
              <div className="mb-4">
                <label className="small text-muted mb-2 text-uppercase tracking-widest fw-bold" style={{ fontSize: '0.6rem' }}>Directives & Scope</label>
                <textarea required className="class-input" rows="4" value={commFormData.description} onChange={e => setCommFormData({...commFormData, description: e.target.value})} placeholder="Mission goals..."></textarea>
              </div>
              <div className="form-check form-switch mb-5 mt-4 d-flex align-items-center gap-3">
                <input className="form-check-input mt-0" type="checkbox" id="privateSwitch" checked={commFormData.isPrivate} onChange={e => setCommFormData({...commFormData, isPrivate: e.target.checked})} style={{width: '2.5rem', height: '1.2rem', cursor: 'pointer'}} />
                <label className="form-check-label text-muted small fw-bold tracking-wider" htmlFor="privateSwitch">ENCRYPTED ENTRY (Requires Admin Auth)</label>
              </div>
              <div className="d-flex justify-content-end gap-3 mt-4 pt-4 border-top border-white border-opacity-5">
                <button type="button" onClick={() => setShowCreateCommModal(false)} className="class-btn class-btn-secondary px-4">CANCEL</button>
                <button type="submit" disabled={loading} className="class-btn px-5 bg-secondary border-0">{loading ? 'ESTABLISHING...' : 'ESTABLISH PRECINCT'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
