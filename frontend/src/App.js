import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import CreateGroup from './pages/CreateGroup';
import AddExpense from './pages/AddExpense';
import Settlements from './pages/Settlements';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <div className="container">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/groups/create"
                element={
                  <PrivateRoute>
                    <CreateGroup />
                  </PrivateRoute>
                }
              />
              <Route
                path="/groups/:groupId"
                element={
                  <PrivateRoute>
                    <GroupDetails />
                  </PrivateRoute>
                }
              />
              <Route
                path="/groups/:groupId/expenses/add"
                element={
                  <PrivateRoute>
                    <AddExpense />
                  </PrivateRoute>
                }
              />
              <Route
                path="/settlements"
                element={
                  <PrivateRoute>
                    <Settlements />
                  </PrivateRoute>
                }
              />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
