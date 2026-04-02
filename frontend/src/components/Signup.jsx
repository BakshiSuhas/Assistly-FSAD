import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Backend API URL
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

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
      const res = await axios.post(`${apiUrl}/auth/signup`, {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      setSuccess("Account created successfully! Redirecting to login...");
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      console.error("Signup failed", err);
      const respData = err.response?.data;
      const errorMsg = respData?.message || (typeof respData === 'string' ? respData : "Registration failed. Please check backend console.");
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
      setError("Failed to register with Google: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="container mt-5 pt-3 mb-5 d-flex justify-content-center">
      <div className="glass-card w-100" style={{maxWidth: '500px'}}>
        <div className="text-center mb-4">
          <h2 className="text-gradient mb-2">Join Assistly</h2>
          <p className="text-light" style={{opacity: 0.8}}>Create an account to start contributing.</p>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {success && <div className="alert alert-success py-2">{success}</div>}

        <form onSubmit={handleStandardSignup}>
          <div className="mb-3">
            <label className="form-label text-light small text-uppercase tracking-wide">Full Name</label>
            <input 
              type="text" 
              name="name"
              className="form-control bg-dark text-light border-secondary" 
              placeholder="Jane Doe"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label text-light small text-uppercase tracking-wide">Email Address</label>
            <input 
              type="email" 
              name="email"
              className="form-control bg-dark text-light border-secondary" 
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="row mb-4">
            <div className="col-md-6 mb-3 mb-md-0">
              <label className="form-label text-light small text-uppercase tracking-wide">Password</label>
              <input 
                type="password" 
                name="password"
                className="form-control bg-dark text-light border-secondary" 
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label text-light small text-uppercase tracking-wide">Confirm</label>
              <input 
                type="password" 
                name="confirmPassword"
                className="form-control bg-dark text-light border-secondary" 
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <button type="submit" className="neon-button w-100 mb-3" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center my-3">
          <span className="text-muted small px-3 bg-dark rounded-pill">OR</span>
        </div>

        <div className="google-login-wrapper mt-0 pt-0 border-0">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google Registration verification failed.')}
            theme="filled_black"
            size="large"
            shape="pill"
            text="signup_with"
            width="100%"
          />
        </div>

        <p className="text-center text-light mt-4 mb-0 small" style={{opacity: 0.8}}>
          Already have an account? <Link to="/login" className="text-info text-decoration-none fw-bold">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
