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
      <div className="glass-card w-100 p-0 overflow-hidden" style={{maxWidth: '500px'}}>
        
        {/* Tab Header for strict Role Segregation */}
        <div className="d-flex border-bottom border-secondary bg-dark text-center">
             <div onClick={() => {setActiveTab('user'); setError(''); setStep(1);}} className={`flex-grow-1 p-3 cursor-pointer ${activeTab==='user'?'bg-primary text-white':'text-secondary'}`} style={{cursor: 'pointer', fontWeight: 'bold'}}>
                 Join as User
             </div>
             <div onClick={() => {setActiveTab('admin'); setError('');}} className={`flex-grow-1 p-3 cursor-pointer ${activeTab==='admin'?'bg-danger text-white':'text-secondary'}`} style={{cursor: 'pointer', fontWeight: 'bold'}}>
                 Platform Admin Setup
             </div>
        </div>

        <div className="p-4">
            <div className="text-center mb-4 mt-2">
            <h2 className="text-gradient mb-2">
                {activeTab === 'user' ? 'Join Assistly' : step === 1 ? '1. Admin Registration' : '2. Community Setup'}
            </h2>
            <p className="text-light" style={{opacity: 0.8}}>
                {step === 1 ? 'Create an account to begin configuring.' : `Logged in securely as ${formData.email}`}
            </p>
            </div>

            {error && <div className="alert alert-danger py-2 border-danger text-center fw-bold">{error}</div>}
            {success && <div className="alert alert-success py-2">{success}</div>}

            {step === 1 && (
                <form onSubmit={handleStandardSignup}>
                <div className="mb-3">
                    <label className="form-label text-light small text-uppercase tracking-wide">Full Name</label>
                    <input type="text" name="name" className="form-control bg-dark text-light border-secondary" placeholder="Jane Doe" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="mb-3">
                    <label className="form-label text-light small text-uppercase tracking-wide">Email Address</label>
                    <input type="email" name="email" className="form-control bg-dark text-light border-secondary" placeholder="name@example.com" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="row mb-4">
                    <div className="col-md-6 mb-3 mb-md-0">
                    <label className="form-label text-light small text-uppercase tracking-wide">Password</label>
                    <input type="password" name="password" className="form-control bg-dark text-light border-secondary" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
                    </div>
                    <div className="col-md-6">
                    <label className="form-label text-light small text-uppercase tracking-wide">Confirm</label>
                    <input type="password" name="confirmPassword" className="form-control bg-dark text-light border-secondary" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />
                    </div>
                </div>
                
                <button type="submit" className={`neon-button w-100 mb-3 ${activeTab === 'admin' ? 'neo-danger' : ''}`} disabled={loading} style={activeTab === 'admin' ? {backgroundColor: '#dc3545', boxShadow: 'none'} : {}}>
                    {loading ? 'Processing...' : activeTab === 'user' ? 'Sign Up' : 'Next: Setup Community'}
                </button>
                </form>
            )}

            {step === 2 && activeTab === 'admin' && (
                <form onSubmit={handleSetupCommunity}>
                    <div className="mb-3">
                        <label className="form-label text-light opacity-75 small text-uppercase">Community Name</label>
                        <input type="text" className="form-control bg-dark text-light border-secondary" placeholder="e.g. Downtown Neighbors" required value={communityName} onChange={e => setCommunityName(e.target.value)} />
                    </div>
                    <div className="mb-4">
                        <label className="form-label text-light opacity-75 small text-uppercase">Rules & Purpose</label>
                        <textarea className="form-control bg-dark text-light border-secondary" rows="3" required value={communityDesc} onChange={e => setCommunityDesc(e.target.value)} placeholder="Describe your group's focus..."></textarea>
                    </div>
                    <button type="submit" disabled={loading} className="btn w-100 fw-bold shadow-sm" style={{backgroundColor: '#ffc107', color: '#000'}}>
                        {loading ? 'Booting Space...' : 'Launch Private Community'}
                    </button>
                </form>
            )}

            {step === 1 && (
                <>
                <div className="text-center my-3"><span className="text-muted small px-3 bg-dark rounded-pill">OR</span></div>
                <div className="google-login-wrapper mt-0 pt-0 border-0">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google Log error')} theme="filled_black" size="large" width="100%" />
                </div>
                </>
            )}

            <p className="text-center text-light mt-4 mb-0 small" style={{opacity: 0.8}}>
            Already have an account? <Link to="/login" className="text-info text-decoration-none fw-bold">Sign In</Link>
            </p>
        </div>
      </div>
    </div>
  );
};
export default Signup;
