import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const apiUrl = 'http://localhost:8080/api';

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await axios.post(`${apiUrl}/auth/reset-password`, {
        email: normalizedEmail,
        newPassword
      });
      setSuccess(res.data?.message || 'Password reset successful. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const respData = err.response?.data;
      setError(respData?.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5 pt-5 d-flex justify-content-center">
      <div className="glass-card w-100 p-4" style={{ maxWidth: '450px' }}>
        <div className="text-center mb-4 mt-2">
          <h2 className="text-gradient mb-2">Reset Password</h2>
          <p className="text-light" style={{ opacity: 0.8 }}>Set a new password for your account.</p>
        </div>

        {error && <div className="alert alert-danger py-2 text-center small fw-bold">{error}</div>}
        {success && <div className="alert alert-success py-2 text-center small fw-bold">{success}</div>}

        <form onSubmit={handleReset}>
          <div className="mb-3">
            <label className="form-label text-light small text-uppercase tracking-wide">Email Address</label>
            <input
              type="email"
              className="form-control bg-dark text-light border-secondary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label text-light small text-uppercase tracking-wide">New Password</label>
            <input
              type="password"
              className="form-control bg-dark text-light border-secondary"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="mb-4">
            <label className="form-label text-light small text-uppercase tracking-wide">Confirm Password</label>
            <input
              type="password"
              className="form-control bg-dark text-light border-secondary"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="neon-button w-100 mb-3" disabled={loading}>
            {loading ? 'Updating...' : 'Reset Password'}
          </button>
        </form>

        <p className="text-center text-light mt-3 mb-0 small" style={{ opacity: 0.8 }}>
          Back to <Link to="/login" className="text-info text-decoration-none fw-bold">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
