import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  UserCheck,
  FileText,
  Wallet,
  ClipboardList,
  Link2,
  ShoppingBag,
  Lightbulb,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const adminNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/bookings', icon: CalendarDays, label: 'Bookings' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/sales', icon: ShoppingBag, label: 'Sales' },
  { to: '/collaborations', icon: Link2, label: 'Collaborations' },
  { to: '/employees', icon: UserCheck, label: 'Employees' },
  { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/ideas', icon: Lightbulb, label: 'Content Ideas' },
  { to: '/content', icon: FileText, label: 'Content Planner' },
];

const employeeNavItems = [
  { to: '/tasks', icon: ClipboardList, label: 'My Tasks', end: true },
];

export default function Sidebar({ open, onClose }) {
  const { isAdmin, profile } = useAuth();
  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/favicon.jpeg"
              alt="Logo"
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
            />
            <span className="font-semibold text-gray-900 text-xs leading-tight">
              People and Style ERP
            </span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Employee name chip */}
        {!isAdmin && profile?.name && (
          <div className="mx-3 mt-3 px-3 py-2 bg-indigo-50 rounded-lg">
            <p className="text-xs text-indigo-500 font-medium">Logged in as</p>
            <p className="text-sm font-semibold text-indigo-800 truncate">{profile.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={17} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">© 2026 People and Style</p>
        </div>
      </aside>
    </>
  );
}
