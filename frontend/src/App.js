import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetails from './pages/GroupDetails';
import ExpenseDetails from './pages/ExpenseDetails';
import CreateGroup from './pages/CreateGroup';
import EditGroup from './pages/EditGroup';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import Settlements from './pages/Settlements';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import useMobileDetection from './hooks/useMobileDetection';

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
        path="/groups"
        element={
          <PrivateRoute>
            <Groups />
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
        path="/groups/:id/edit"
        element={
          <PrivateRoute>
            <EditGroup />
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
        path="/groups/:groupId/expenses/:expenseId/edit"
        element={
          <PrivateRoute>
            <EditExpense />
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
      <Route
        path="/reports"
        element={
          <PrivateRoute>
            <Reports />
          </PrivateRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};

function App() {
  // Enable mobile detection for bottom tabs
  useMobileDetection();

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
