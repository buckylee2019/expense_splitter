import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          💰 ExpenseSplitter
        </Link>
        
        {isAuthenticated ? (
          <div className="nav-menu">
            <Link to="/" className="nav-link">Dashboard</Link>
            <Link to="/groups/create" className="nav-link">Create Group</Link>
            <Link to="/settlements" className="nav-link">Settlements</Link>
            <div className="nav-user">
              <span className="user-email">{user?.email}</span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="nav-menu">
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="nav-link">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
