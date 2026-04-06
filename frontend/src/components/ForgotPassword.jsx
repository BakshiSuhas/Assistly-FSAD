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
      <div className="premium-glass w-100 p-5 animate-in" style={{ maxWidth: '450px' }}>
        <div className="text-center mb-5">
          <h2 className="accent-gradient mb-3" style={{ fontSize: '2rem' }}>Reset Access</h2>
          <p className="text-muted small">Update your neural security credentials.</p>
        </div>

        {error && <div className="alert bg-danger bg-opacity-10 text-danger border-danger border-opacity-25 py-3 text-center small fw-bold mb-4">{error}</div>}
        {success && <div className="alert bg-secondary bg-opacity-10 text-secondary border-secondary border-opacity-25 py-3 text-center small fw-bold mb-4">{success}</div>}

        <form onSubmit={handleReset}>
          <div className="mb-4">
            <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Email Identity</label>
            <input
              type="email"
              className="class-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="id@community.net"
              required
            />
          </div>
          <div className="mb-4">
            <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">New Security Key</label>
            <input
              type="password"
              className="class-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          <div className="mb-5">
            <label className="form-label text-muted small text-uppercase tracking-wider fw-bold mb-2">Confirm New Key</label>
            <input
              type="password"
              className="class-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="class-btn w-100 py-3 mb-3" disabled={loading}>
            {loading ? 'Transmitting...' : 'Update Credentials'}
          </button>
        </form>

        <p className="text-center text-muted mt-4 mb-0 small">
          Return to <Link to="/login" className="text-primary text-decoration-none fw-bold">Login Terminal</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
