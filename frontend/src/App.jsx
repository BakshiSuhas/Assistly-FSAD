import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';

const Home = () => (
  <div className="container mt-5 pt-5 text-center">
    <div className="glass-card mx-auto" style={{maxWidth: '800px', marginTop: '10vh'}}>
      <h1 className="display-4 text-gradient mb-4">Welcome to Assistly</h1>
      <p className="lead text-light mb-5">
        Your intelligent, role-based community service platform. <br/>
        Connect, volunteer, and make a lasting impact today.
      </p>
      <div className="d-flex justify-content-center gap-4 mt-4">
        <Link to="/login" className="neon-button">Get Started <i className="bi bi-arrow-right"></i></Link>
        <Link to="/signup" className="neon-button-secondary">Join Community</Link>
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
      <nav className="navbar navbar-expand-lg navbar-dark nav-glass fixed-top">
        <div className="container">
          <Link className="navbar-brand fw-bold text-gradient" to="/">Assistly</Link>
          <div className="navbar-nav ms-auto gap-3 align-items-center">
            {user ? (
                <>
                  <span className="text-light small opacity-75 fst-italic me-2">Welcome, {user.name}</span>
                  <Link className="nav-link" to={user.role === 'ROLE_ADMIN' || user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/user'}>Dashboard</Link>
                  <button onClick={handleLogout} className="btn nav-link text-warning fw-bold border-0 bg-transparent">Logout</button>
                </>
            ) : (
                <>
                  <Link className="nav-link" to="/login">Login</Link>
                  <Link className="nav-link" to="/signup">Signup</Link>
                </>
            )}
          </div>
        </div>
      </nav>
      
      {/* Spacer for fixed top navbar */}
      <div style={{height: '60px'}}></div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-signup" element={<Signup />} />
        <Route path="/dashboard/user" element={<UserDashboard />} />
        <Route path="/dashboard/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
