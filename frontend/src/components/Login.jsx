import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const Login = () => {
  const [activeTab, setActiveTab] = useState('user'); // 'user' or 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const apiUrl = 'http://localhost:8080/api';

  const handleStandardLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await axios.post(`${apiUrl}/auth/login`, {
        email: normalizedEmail,
        password
      });

      const userRole = res.data.role;
      const isAdmin = userRole === 'ROLE_ADMIN' || userRole === 'ADMIN';

      // Enforce the visual portal constraints "Let them login respectively according to their roles"
      if (activeTab === 'admin' && !isAdmin) {
          setError("Access Denied: These credentials belong to a Resident, not an administrator.");
          setLoading(false);
          return;
      }
      if (activeTab === 'user' && isAdmin) {
          setError("Account Mapping: You are a Platform Admin. Please use the Admin Portal.");
          setLoading(false);
          return;
      }

      localStorage.setItem("user", JSON.stringify(res.data));
      // Force hardware reload so App.jsx Navbar captures new state immediately
      window.location.href = isAdmin ? '/dashboard/admin' : '/dashboard/user';
    } catch (err) {
      console.error("Login failed", err);
      const respData = err.response?.data;
      setError(respData?.message || (typeof respData === 'string' ? respData : "Invalid email or password"));
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
      
      const userRole = res.data.role;
      const isAdmin = userRole === 'ROLE_ADMIN' || userRole === 'ADMIN';
      
      localStorage.setItem("user", JSON.stringify(res.data));
      window.location.href = isAdmin ? '/dashboard/admin' : '/dashboard/user';
    } catch (err) {
      setError("Failed to authenticate with Google: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="container mt-5 pt-5 d-flex justify-content-center">
      <div className="premium-glass w-100 p-0 overflow-hidden animate-in" style={{maxWidth: '450px'}}>
        
        {/* Tab Header for strict Role Segregation */}
        <div className="d-flex text-center" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
             <div onClick={() => {setActiveTab('user'); setError('');}} className={`flex-grow-1 p-4 cursor-pointer transition-all ${activeTab==='user'?'text-primary border-bottom border-primary':'text-muted opacity-50'}`} style={{cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', fontSize: '0.8rem', textTransform: 'uppercase'}}>
                 Resident Portal
             </div>
             <div onClick={() => {setActiveTab('admin'); setError('');}} className={`flex-grow-1 p-4 cursor-pointer transition-all ${activeTab==='admin'?'text-danger border-bottom border-danger':'text-muted opacity-50'}`} style={{cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', fontSize: '0.8rem', textTransform: 'uppercase'}}>
                 Admin Console
             </div>
        </div>

        <div className="p-5">
            <div className="text-center mb-5">
              <h2 className="accent-gradient mb-3" style={{ fontSize: '2rem' }}>{activeTab === 'user' ? 'Welcome Back' : 'Security Terminal'}</h2>
              <p className="text-muted small">Please verify your credentials to access the community.</p>
            </div>

            {error && <div className="alert bg-danger bg-opacity-10 text-danger border-danger border-opacity-25 py-3 text-center small fw-bold mb-4">{error}</div>}

            <form onSubmit={handleStandardLogin}>
            <div className="mb-4">
                <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Email Identity</label>
                <input type="email" className="class-input" placeholder="id@community.net" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="mb-4">
                <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Security Key</label>
                <input type="password" className="class-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            
            <button type="submit" className={`class-btn w-100 py-3 mb-3 ${activeTab === 'admin' ? 'bg-danger shadow-none' : ''}`} disabled={loading}>
                {loading ? 'Verifying...' : `Continue to ${activeTab === 'user' ? 'Dashboard' : 'Terminal'}`}
            </button>
            </form>
            <div className="text-center mb-4">
              <Link to="/forgot-password" className="text-primary text-decoration-none small fw-bold opacity-75 hover-opacity-100 transition-all">
                Reset Access Credentials?
              </Link>
            </div>

            <div className="d-flex align-items-center my-4">
              <hr className="flex-grow-1 border-secondary opacity-25" />
              <span className="text-muted small px-3 text-uppercase tracking-widest opacity-50" style={{ fontSize: '0.6rem' }}>External Auth</span>
              <hr className="flex-grow-1 border-secondary opacity-25" />
            </div>

            <div className="google-login-wrapper mt-0 pt-0 border-0">
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google Auth Failure')} theme="filled_black" size="large" width="100%" shape="pill" />
            </div>

            <p className="text-center text-muted mt-5 mb-0 small">
            New operative? <Link to="/signup" className="text-primary text-decoration-none fw-bold">Register Profile</Link>
            </p>
        </div>
      </div>
    </div>
  );
};
export default Login;
