import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Backend API URL
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  const handleStandardLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password
      });
      localStorage.setItem("user", JSON.stringify(res.data));
      navigate(res.data.role === 'ROLE_ADMIN' ? '/dashboard/admin' : '/dashboard/user');
    } catch (err) {
      console.error("Login failed", err);
      const respData = err.response?.data;
      const errorMsg = respData?.message || (typeof respData === 'string' ? respData : "Invalid email or password");
      setError(errorMsg);
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
      navigate(res.data.role === 'ROLE_ADMIN' ? '/dashboard/admin' : '/dashboard/user');
    } catch (err) {
      console.error("Google authentication failed", err);
      setError("Failed to authenticate with Google: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="container mt-5 pt-5 d-flex justify-content-center">
      <div className="glass-card w-100" style={{maxWidth: '450px'}}>
        <div className="text-center mb-4">
          <h2 className="text-gradient mb-2">Welcome Back</h2>
          <p className="text-light" style={{opacity: 0.8}}>Sign in to your Assistly account.</p>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <form onSubmit={handleStandardLogin}>
          <div className="mb-3">
            <label className="form-label text-light small text-uppercase tracking-wide">Email Address</label>
            <input 
              type="email" 
              className="form-control bg-dark text-light border-secondary" 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="form-label text-light small text-uppercase tracking-wide">Password</label>
            <input 
              type="password" 
              className="form-control bg-dark text-light border-secondary" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="neon-button w-100 mb-3" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center my-3">
          <span className="text-muted small px-3 bg-dark rounded-pill">OR</span>
        </div>

        <div className="google-login-wrapper mt-0 pt-0 border-0">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google Login verification failed.')}
            theme="filled_black"
            size="large"
            shape="pill"
            text="signin_with"
            width="100%"
          />
        </div>

        <p className="text-center text-light mt-4 mb-0 small" style={{opacity: 0.8}}>
          Don't have an account? <Link to="/signup" className="text-info text-decoration-none fw-bold">Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
