import { useState } from 'react';
import { Menu, LogOut, ChevronDown, ShieldCheck, UserCircle2, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { logout } from '../services/firebase/auth';
import toast from 'react-hot-toast';
import NotificationBell from './NotificationBell';

export default function Navbar({ onMenuClick }) {
  const { user, profile, role, isAdmin, isEmployee } = useAuth();
  const { dark, toggle } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out');
    } catch {
      toast.error('Logout failed');
    }
  };

  const displayName = profile?.name || user?.email || '';
  const displayRole = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : isAdmin ? 'Admin' : '';

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 z-10 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification bell — employees only */}
        {isEmployee && <NotificationBell />}

      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {/* Avatar with initials */}
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-indigo-600">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-800 max-w-[140px] truncate leading-tight">
              {profile?.name || 'Admin'}
            </p>
            <p className="text-xs text-gray-400 leading-tight">
              {isAdmin ? 'Admin' : profile?.role || 'Employee'}
            </p>
          </div>

          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg py-1 z-20">
              {/* Profile info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {profile?.name || 'Admin'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isAdmin
                        ? <ShieldCheck size={11} className="text-indigo-500 flex-shrink-0" />
                        : <UserCircle2 size={11} className="text-green-500 flex-shrink-0" />
                      }
                      <span className="text-xs text-gray-500">
                        {isAdmin ? 'Administrator' : profile?.role || 'Employee'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </header>
  );
}
