import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActiveLink = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        {/* Mobile Menu Toggle - Left Side */}
        {isAuthenticated && (
          <button 
            className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        )}

        {/* Logo - Center on mobile, left on desktop */}
        <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
          💰 ExpenseSplitter
        </Link>
        
        {isAuthenticated ? (
          <>
            {/* Navigation Menu */}
            <div className={`nav-menu ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
              <div className="nav-links">
                <Link 
                  to="/" 
                  className={`nav-link ${isActiveLink('/') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <span className="nav-icon">🏠</span>
                  <span className="nav-text">Dashboard</span>
                </Link>
                <Link 
                  to="/groups" 
                  className={`nav-link ${isActiveLink('/groups') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <span className="nav-icon">👥</span>
                  <span className="nav-text">Groups</span>
                </Link>
                <Link 
                  to="/settlements" 
                  className={`nav-link ${isActiveLink('/settlements') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <span className="nav-icon">💵</span>
                  <span className="nav-text">Settlements</span>
                </Link>
                <Link 
                  to="/reports" 
                  className={`nav-link ${isActiveLink('/reports') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-text">Reports</span>
                </Link>
                <Link 
                  to="/profile" 
                  className={`nav-link ${isActiveLink('/profile') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <span className="nav-icon">👤</span>
                  <span className="nav-text">Profile</span>
                </Link>
              </div>
              
              <div className="nav-user">
                <div className="user-info">
                  <span className="user-name">{user?.name || 'User'}</span>
                  <span className="user-email">{user?.email}</span>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                  <span className="nav-icon">🚪</span>
                  <span className="nav-text">Logout</span>
                </button>
              </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
              <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
            )}

            {/* Desktop spacer */}
            <div className="nav-spacer"></div>
          </>
        ) : (
          <div className="nav-auth">
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="nav-link">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
