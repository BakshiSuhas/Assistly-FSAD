import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ChatbotWidget from './components/ChatbotWidget';

const Home = () => (
  <div className="container mt-5 pt-5 text-center">
    <div className="premium-glass mx-auto p-5 animate-in" style={{maxWidth: '850px', marginTop: '12vh'}}>
      <h1 className="display-3 accent-gradient mb-4 fw-bold">Elevate Your Community</h1>
      <p className="lead text-muted mb-5 px-lg-5" style={{ fontSize: '1.2rem', lineHeight: '1.8' }}>
        Assistly is the next-generation community platform for intelligent community coordination. 
        Deploy resources, mobilize volunteers, and track impact with precision.
      </p>
      <div className="d-flex justify-content-center gap-4 mt-5">
        <Link to="/login" className="class-btn px-5 py-3">Deploy Console <i className="bi bi-chevron-right ms-2"></i></Link>
        <Link to="/signup" className="class-btn class-btn-secondary px-5 py-3">Join The Community</Link>
      </div>
    </div>
  </div>
);

function App() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Invalid user in localStorage', err);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <Router>
      <nav className="navbar navbar-expand-lg navbar-dark fixed-top py-3" style={{ background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--glass-border)' }}>
        <div className="container">
          <Link className="navbar-brand fw-bold accent-gradient fs-3 me-5" to="/">ASSISTLY</Link>
          <div className="navbar-nav ms-auto gap-4 align-items-center">
            {user ? (
                <>
                  <div className="px-3 py-1 rounded-pill bg-white bg-opacity-5 border border-white border-opacity-10 d-none d-md-block">
                    <span className="text-muted small fw-bold tracking-widest opacity-75">OPERATIVE: </span>
                    <span className="text-primary small fw-bold mono">{user.name.toUpperCase()}</span>
                  </div>
                  <Link className="nav-link fw-bold text-uppercase tracking-widest" style={{ fontSize: '0.75rem' }} to={user.role === 'ROLE_ADMIN' || user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/user'} onClick={() => window.location.pathname.startsWith('/dashboard') && window.location.reload()}>Dashboard</Link>
                  <button onClick={handleLogout} className="class-btn class-btn-secondary py-1 px-3 border-0 small text-danger bg-transparent fw-bold text-uppercase tracking-widest" style={{ fontSize: '0.75rem' }}>Abort Session</button>
                </>
            ) : (
                <>
                  <Link className="nav-link fw-bold text-uppercase tracking-widest" style={{ fontSize: '0.75rem' }} to="/login">Login</Link>
                  <Link className="class-btn px-4 py-2 small text-uppercase tracking-widest" style={{ fontSize: '0.7rem' }} to="/signup">Register</Link>
                </>
            )}
          </div>
        </div>
      </nav>
      
      {/* Spacer for fixed top navbar */}
      <div style={{height: '90px'}}></div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-signup" element={<Signup />} />
        <Route path="/dashboard/user" element={<UserDashboard />} />
        <Route path="/dashboard/admin" element={<AdminDashboard />} />
      </Routes>
      <ChatbotWidget />
    </Router>
  );
}

export default App;
