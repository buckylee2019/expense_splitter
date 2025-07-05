import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);
    
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
          <h2 className="mb-0">Welcome Back!</h2>
          <p className="text-secondary">Sign in to manage your shared expenses</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
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
              placeholder="Enter your password"
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? <><i className="fi fi-rr-refresh"></i> Signing in...</> : <><i className="fi fi-rr-sign-in-alt"></i> Sign In</>}
          </button>
        </form>
        
        <div className="auth-link">
          <p>Don't have an account? <Link to="/register">Create one here</Link></p>
        </div>

        <div className="auth-demo mt-lg">
          <div className="demo-section">
            <h4><i className="fi fi-rr-target"></i> Demo Credentials</h4>
            <p className="help-text">Try the app with these test accounts:</p>
            <div className="demo-accounts">
              <div className="demo-account">
                <strong>Alice:</strong> alice@example.com / password123
              </div>
              <div className="demo-account">
                <strong>Bob:</strong> bob@example.com / password123
              </div>
              <div className="demo-account">
                <strong>Charlie:</strong> charlie@example.com / password123
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
