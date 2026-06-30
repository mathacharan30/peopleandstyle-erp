import { Search, X } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full sm:w-64 pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg bg-white
          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
