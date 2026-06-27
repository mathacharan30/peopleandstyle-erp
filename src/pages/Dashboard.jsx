import { useMemo } from 'react';
import { CalendarDays, Truck, RotateCcw, CheckCircle2, TrendingUp } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { formatCurrency, formatDate } from '../utils/helpers';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

function StatCard({ icon: Icon, label, value, color, subLabel }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {subLabel && <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: bookings, loading } = useFirestore('bookings');

  const stats = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.bookingStatus === 'Pending').length;
    const delivered = bookings.filter((b) => b.bookingStatus === 'Delivered').length;
    const returned = bookings.filter((b) => b.bookingStatus === 'Returned').length;
    return { total, pending, delivered, returned };
  }, [bookings]);

  const recent = useMemo(() => bookings.slice(0, 5), [bookings]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your rental business</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays} label="Total Bookings" value={stats.total} color="indigo" />
        <StatCard icon={Truck} label="Pending Deliveries" value={stats.pending} color="yellow" />
        <StatCard icon={RotateCcw} label="Pending Returns" value={stats.delivered} color="blue" />
        <StatCard icon={CheckCircle2} label="Completed Orders" value={stats.returned} color="green" />
      </div>

      {/* Recent bookings */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No bookings yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Booking ID', 'Customer', 'Event Date', 'Service', 'Status', 'Payment'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{b.bookingId}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{b.customerName}</td>
                    <td className="px-5 py-3 text-gray-600">{formatDate(b.eventDate)}</td>
                    <td className="px-5 py-3 text-gray-600">{b.serviceType}</td>
                    <td className="px-5 py-3">
                      <Badge>{b.bookingStatus}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge>{b.paymentStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
