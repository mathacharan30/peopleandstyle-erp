import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { loginWithEmail } from '../services/firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const onSubmit = async ({ email, password }) => {
    try {
      await loginWithEmail(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (e) {
      const msg =
        e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
          ? 'Invalid email or password'
          : e.code === 'auth/user-not-found'
          ? 'No account found with this email'
          : e.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : 'Sign in failed. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 mb-4">
            <CalendarDays size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rental ERP</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your admin account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3 top-[2.35rem] text-gray-400 pointer-events-none z-10"
              />
              <Input
                label="Email address"
                type="email"
                placeholder="admin@example.com"
                className="pl-9"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                })}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-[2.35rem] text-gray-400 pointer-events-none z-10"
              />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-9 pr-10"
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Minimum 6 characters' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[2.25rem] text-gray-400 hover:text-gray-600 transition-colors z-10"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              loading={isSubmitting}
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
