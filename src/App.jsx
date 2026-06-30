import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Bookings from './pages/Bookings';
import Finance from './pages/Finance';
import Employees from './pages/Employees';
import Tasks from './pages/Tasks';
import Collaborations from './pages/Collaborations';
import ContentPlanner from './pages/ContentPlanner';
import ContentIdeas from './pages/ContentIdeas';
import Sales from './pages/Sales';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          {/* Admin-only routes */}
          <Route element={<AdminRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="finance" element={<Finance />} />
            <Route path="collaborations" element={<Collaborations />} />
            <Route path="employees" element={<Employees />} />
            <Route path="content" element={<ContentPlanner />} />
            <Route path="ideas" element={<ContentIdeas />} />
            <Route path="sales" element={<Sales />} />
          </Route>
          {/* Shared route — employees see filtered tasks, admins see all */}
          <Route path="tasks" element={<Tasks />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
