import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
      <Loader2 size={32} className="animate-spin text-indigo-500" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
