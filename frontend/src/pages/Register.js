import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');

    const result = await register(formData.username, formData.email, formData.password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="text-center mb-xl">
          <h1 className="mb-sm"><i className="fi fi-rr-calculator"></i> ExpenseSplitter</h1>
          <h2 className="mb-0">Create Account</h2>
          <p className="text-secondary">Join thousands splitting expenses effortlessly</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username"><i className="fi fi-rr-user"></i> Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Choose a unique username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">📧 Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email address"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">🔒 Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Create a secure password (min 6 chars)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">🔐 Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? <><i className="fi fi-rr-refresh"></i> Creating Account...</> : <><i className="fi fi-rr-party-horn"></i> Create Account</>}
          </button>
        </form>
        
        <div className="auth-link">
          <p>Already have an account? <Link to="/login">Sign in here</Link></p>
        </div>

        <div className="auth-features mt-lg">
          <h4>✨ What you'll get:</h4>
          <ul className="features-list">
            <li><i className="fi fi-rr-home"></i> Create unlimited expense groups</li>
            <li><i className="fi fi-rr-users"></i> Add friends and family members</li>
            <li><i className="fi fi-rr-calculator"></i> Track who owes what automatically</li>
            <li><i className="fi fi-rr-chart-pie"></i> View detailed expense history</li>
            <li><i className="fi fi-rr-credit-card"></i> Record settlements easily</li>
            <li>🔒 Secure and private data</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Register;
