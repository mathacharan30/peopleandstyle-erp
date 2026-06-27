const variants = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 text-gray-600',
  indigo: 'bg-indigo-100 text-indigo-700',
};

const statusMap = {
  Active: 'green',
  Inactive: 'red',
  Pending: 'yellow',
  Delivered: 'blue',
  Returned: 'green',
  Paid: 'green',
  Planned: 'indigo',
  Posted: 'green',
  Yes: 'red',
  No: 'green',
};

export default function Badge({ children, color }) {
  const resolved = color ?? statusMap[children] ?? 'gray';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[resolved]}`}
    >
      {children}
    </span>
  );
}
