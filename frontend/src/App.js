import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import ExpenseDetails from './pages/ExpenseDetails';
import CreateGroup from './pages/CreateGroup';
import AddExpense from './pages/AddExpense';
import Settlements from './pages/Settlements';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const location = useLocation();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard key={location.pathname + location.search} />
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
            <GroupDetails key={location.pathname + location.search} />
          </PrivateRoute>
        }
      />
      <Route
        path="/groups/:groupId/expenses/:expenseId"
        element={
          <PrivateRoute>
            <ExpenseDetails />
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
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <div className="container">
            <AppRoutes />
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
