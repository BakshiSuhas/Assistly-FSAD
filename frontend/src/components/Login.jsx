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
      <div className="glass-card w-100 p-0 overflow-hidden" style={{maxWidth: '450px'}}>
        
        {/* Tab Header for strict Role Segregation */}
        <div className="d-flex border-bottom border-secondary bg-dark text-center">
             <div onClick={() => {setActiveTab('user'); setError('');}} className={`flex-grow-1 p-3 cursor-pointer ${activeTab==='user'?'bg-primary text-white':'text-secondary'}`} style={{cursor: 'pointer', fontWeight: 'bold'}}>
                 Resident/Volunteer
             </div>
             <div onClick={() => {setActiveTab('admin'); setError('');}} className={`flex-grow-1 p-3 cursor-pointer ${activeTab==='admin'?'bg-danger text-white':'text-secondary'}`} style={{cursor: 'pointer', fontWeight: 'bold'}}>
                 Platform Admin
             </div>
        </div>

        <div className="p-4">
            <div className="text-center mb-4 mt-2">
            <h2 className="text-gradient mb-2">{activeTab === 'user' ? 'Resident Portal' : 'Admin Operations'}</h2>
            <p className="text-light" style={{opacity: 0.8}}>Securely enter your credentials.</p>
            </div>

            {error && <div className="alert alert-danger py-2 text-center small fw-bold">{error}</div>}

            <form onSubmit={handleStandardLogin}>
            <div className="mb-3">
                <label className="form-label text-light small text-uppercase tracking-wide">Email Address</label>
                <input type="email" className="form-control bg-dark text-light border-secondary" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="mb-4">
                <label className="form-label text-light small text-uppercase tracking-wide">Password</label>
                <input type="password" className="form-control bg-dark text-light border-secondary" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            
            <button type="submit" className={`neon-button w-100 mb-3 ${activeTab === 'admin' ? 'neo-danger' : ''}`} disabled={loading} style={activeTab === 'admin' ? {backgroundColor: '#dc3545', boxShadow: 'none'} : {}}>
                {loading ? 'Authenticating...' : `Access ${activeTab === 'user' ? 'Dashboard' : 'Console'}`}
            </button>
            </form>
            <div className="text-center mb-3">
              <Link to="/forgot-password" className="text-info text-decoration-none small fw-bold">
                Forgot password?
              </Link>
            </div>

            <div className="text-center my-3">
            <span className="text-muted small px-3 bg-dark rounded-pill">OR</span>
            </div>

            <div className="google-login-wrapper mt-0 pt-0 border-0">
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google Log error')} theme="filled_black" size="large" width="100%" />
            </div>

            <p className="text-center text-light mt-4 mb-0 small" style={{opacity: 0.8}}>
            Don't have an account? <Link to="/signup" className="text-info text-decoration-none fw-bold">Sign Up Here</Link>
            </p>
        </div>
      </div>
    </div>
  );
};
export default Login;
