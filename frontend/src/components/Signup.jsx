import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const Signup = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('user'); // 'user' or 'admin'
  const [step, setStep] = useState(1);

  // User payload
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  
  // Admin community payload
  const [communityName, setCommunityName] = useState('');
  const [communityDesc, setCommunityDesc] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const apiUrl = 'http://localhost:8080/api';

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleStandardSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      if (activeTab === 'user') {
          await axios.post(`${apiUrl}/auth/signup`, {
            name: formData.name,
            email: normalizedEmail,
            password: formData.password
          });
          setSuccess("Account created successfully! Redirecting to login...");
          setTimeout(() => navigate('/login'), 2000);
      } else {
          // Admin signup phase 1
          await axios.post(`${apiUrl}/auth/signup`, { 
              name: formData.name, 
              email: normalizedEmail, 
              password: formData.password, 
              role: 'ADMIN' 
          });
          setStep(2); // Move to community initialization
      }
    } catch (err) {
      console.error("Signup failed", err);
      const respData = err.response?.data;
      setError(respData?.message || (typeof respData === 'string' ? respData : "Registration failed. Please check backend console."));
    } finally {
      setLoading(false);
    }
  };

  const handleSetupCommunity = async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
          const loginRes = await axios.post(`${apiUrl}/auth/login`, { email: formData.email, password: formData.password });
          const userToken = loginRes.data;
          
          await axios.post(`${apiUrl}/communities`, 
              { name: communityName, description: communityDesc },
              { headers: { Authorization: `Bearer ${userToken.token}` } }
          );

          localStorage.setItem('user', JSON.stringify(userToken));
          window.location.href = '/dashboard/user';
      } catch (err) {
          setError(err.response?.data?.message || 'Failed to initialize the community framework.');
      } finally {
          setLoading(false);
      }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    try {
      const res = await axios.post(`${apiUrl}/auth/google`, {
        tokenId: credentialResponse.credential
      });
      localStorage.setItem("user", JSON.stringify(res.data));
      window.location.href = res.data.role === 'ROLE_ADMIN' || res.data.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/user';
    } catch (err) {
      setError("Failed to register with Google: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="container mt-5 pt-3 mb-5 d-flex justify-content-center">
      <div className="premium-glass w-100 p-0 overflow-hidden animate-in" style={{maxWidth: '500px'}}>
        
        {/* Tab Header for strict Role Segregation */}
        <div className="d-flex text-center" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
             <div onClick={() => {setActiveTab('user'); setError(''); setStep(1);}} className={`flex-grow-1 p-4 cursor-pointer transition-all ${activeTab==='user'?'text-primary border-bottom border-primary':'text-muted opacity-50'}`} style={{cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', fontSize: '0.8rem', textTransform: 'uppercase'}}>
                 Resident Profile
             </div>
             <div onClick={() => {setActiveTab('admin'); setError('');}} className={`flex-grow-1 p-4 cursor-pointer transition-all ${activeTab==='admin'?'text-danger border-bottom border-danger':'text-muted opacity-50'}`} style={{cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', fontSize: '0.8rem', textTransform: 'uppercase'}}>
                 Admin Setup
             </div>
        </div>

        <div className="p-5">
            <div className="text-center mb-5">
            <h2 className="accent-gradient mb-3" style={{ fontSize: '2rem' }}>
                {activeTab === 'user' ? 'Join Community' : step === 1 ? 'Admin Registry' : 'Precinct Setup'}
            </h2>
            <p className="text-muted small">
                {step === 1 ? 'Initialize your operative profile.' : `Authenticated as ${formData.email.split('@')[0]}`}
            </p>
            </div>

            {error && <div className="alert bg-danger bg-opacity-10 text-danger border-danger border-opacity-25 py-3 text-center small fw-bold mb-4">{error}</div>}
            {success && <div className="alert bg-secondary bg-opacity-10 text-secondary border-secondary border-opacity-25 py-3 text-center small fw-bold mb-4">{success}</div>}

            {step === 1 && (
                <form onSubmit={handleStandardSignup}>
                <div className="mb-4">
                    <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Display Alias</label>
                    <input type="text" name="name" className="class-input" placeholder="Operative Name" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="mb-4">
                    <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Email Identity</label>
                    <input type="email" name="email" className="class-input" placeholder="id@community.net" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="row mb-5">
                    <div className="col-md-6 mb-4 mb-md-0">
                    <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Security Key</label>
                    <input type="password" name="password" className="class-input" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
                    </div>
                    <div className="col-md-6">
                    <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Confirm Key</label>
                    <input type="password" name="confirmPassword" className="class-input" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />
                    </div>
                </div>
                
                <button type="submit" className={`class-btn w-100 py-3 mb-3 ${activeTab === 'admin' ? 'bg-danger shadow-none' : ''}`} disabled={loading}>
                    {loading ? 'Initializing...' : activeTab === 'user' ? 'Register Profile' : 'Next: Precinct Configuration'}
                </button>
                </form>
            )}

            {step === 2 && activeTab === 'admin' && (
                <form onSubmit={handleSetupCommunity}>
                    <div className="mb-4">
                        <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Precinct Designation</label>
                        <input type="text" className="class-input" placeholder="e.g. Sector-7 Neighbors" required value={communityName} onChange={e => setCommunityName(e.target.value)} />
                    </div>
                    <div className="mb-5">
                        <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Directives & Scope</label>
                        <textarea className="class-input" rows="4" required value={communityDesc} onChange={e => setCommunityDesc(e.target.value)} placeholder="Mission goals and community guidelines..."></textarea>
                    </div>
                    <button type="submit" disabled={loading} className="class-btn w-100 py-3" style={{backgroundColor: 'var(--accent)', color: '#000', border: 'none'}}>
                        {loading ? 'Establishing Framework...' : 'Launch Precinct Platform'}
                    </button>
                </form>
            )}

            {step === 1 && (
                <>
                <div className="d-flex align-items-center my-4">
                  <hr className="flex-grow-1 border-secondary opacity-25" />
                  <span className="text-muted small px-3 text-uppercase tracking-widest opacity-50" style={{ fontSize: '0.6rem' }}>External Registry</span>
                  <hr className="flex-grow-1 border-secondary opacity-25" />
                </div>
                <div className="google-login-wrapper mt-0 pt-0 border-0">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google Auth Failure')} theme="filled_black" size="large" width="100%" shape="pill" />
                </div>
                </>
            )}

            <p className="text-center text-muted mt-5 mb-0 small">
            Existing operative? <Link to="/login" className="text-primary text-decoration-none fw-bold">Sign In</Link>
            </p>
        </div>
      </div>
    </div>
  );
};
export default Signup;
