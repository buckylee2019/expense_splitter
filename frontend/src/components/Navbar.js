import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HomeIcon, GroupIcon, MoneyIcon, ChartIcon, ProfileIcon, LogoutIcon } from './Icons';

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActiveLink = (path) => {
    return location.pathname === path;
  };

  if (!isAuthenticated) {
    return (
      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            💰 ExpenseSplitter
          </Link>
          <div className="nav-auth">
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="nav-link">Register</Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      {/* Desktop/Tablet Navigation */}
      <nav className="navbar desktop-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            💰 ExpenseSplitter
          </Link>
          
          <div className="nav-menu">
            <div className="nav-links">
              <Link 
                to="/" 
                className={`nav-link ${isActiveLink('/') ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <HomeIcon size={18} />
                </span>
                <span className="nav-text">Dashboard</span>
              </Link>
              <Link 
                to="/groups" 
                className={`nav-link ${isActiveLink('/groups') ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <GroupIcon size={18} />
                </span>
                <span className="nav-text">Groups</span>
              </Link>
              <Link 
                to="/settlements" 
                className={`nav-link ${isActiveLink('/settlements') ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <MoneyIcon size={18} />
                </span>
                <span className="nav-text">Settlements</span>
              </Link>
              <Link 
                to="/reports" 
                className={`nav-link ${isActiveLink('/reports') ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <ChartIcon size={18} />
                </span>
                <span className="nav-text">Reports</span>
              </Link>
              <Link 
                to="/profile" 
                className={`nav-link ${isActiveLink('/profile') ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <ProfileIcon size={18} />
                </span>
                <span className="nav-text">Profile</span>
              </Link>
            </div>
            
            <div className="nav-user">
              <div className="user-info">
                <span className="user-name">{user?.name || 'User'}</span>
                <span className="user-email">{user?.email}</span>
              </div>
              <button onClick={handleLogout} className="logout-btn">
                <span className="nav-icon">
                  <LogoutIcon size={18} />
                </span>
                <span className="nav-text">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="mobile-tabs">
        <Link 
          to="/" 
          className={`tab-item ${isActiveLink('/') ? 'active' : ''}`}
        >
          <div className="tab-icon">
            <HomeIcon size={20} color={isActiveLink('/') ? '#007bff' : '#6c757d'} />
          </div>
          <span className="tab-label">Home</span>
        </Link>
        <Link 
          to="/groups" 
          className={`tab-item ${isActiveLink('/groups') ? 'active' : ''}`}
        >
          <div className="tab-icon">
            <GroupIcon size={20} color={isActiveLink('/groups') ? '#007bff' : '#6c757d'} />
          </div>
          <span className="tab-label">Groups</span>
        </Link>
        <Link 
          to="/settlements" 
          className={`tab-item ${isActiveLink('/settlements') ? 'active' : ''}`}
        >
          <div className="tab-icon">
            <MoneyIcon size={20} color={isActiveLink('/settlements') ? '#007bff' : '#6c757d'} />
          </div>
          <span className="tab-label">Settle</span>
        </Link>
        <Link 
          to="/reports" 
          className={`tab-item ${isActiveLink('/reports') ? 'active' : ''}`}
        >
          <div className="tab-icon">
            <ChartIcon size={20} color={isActiveLink('/reports') ? '#007bff' : '#6c757d'} />
          </div>
          <span className="tab-label">Reports</span>
        </Link>
        <Link 
          to="/profile" 
          className={`tab-item ${isActiveLink('/profile') ? 'active' : ''}`}
        >
          <div className="tab-icon">
            <ProfileIcon size={20} color={isActiveLink('/profile') ? '#007bff' : '#6c757d'} />
          </div>
          <span className="tab-label">Profile</span>
        </Link>
      </nav>
    </>
  );
};

export default Navbar;
