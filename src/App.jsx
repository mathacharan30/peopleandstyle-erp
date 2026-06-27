import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Bookings from './pages/Bookings';
import Finance from './pages/Finance';
import Employees from './pages/Employees';
import Tasks from './pages/Tasks';
import ContentPlanner from './pages/ContentPlanner';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="finance" element={<Finance />} />
          <Route path="employees" element={<Employees />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="content" element={<ContentPlanner />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
