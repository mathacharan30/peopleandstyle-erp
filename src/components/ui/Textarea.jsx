import { forwardRef } from 'react';

const Textarea = forwardRef(function Textarea(
  { label, error, className = '', required, rows = 3, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={`
          w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900
          placeholder:text-gray-400 resize-none transition-colors
          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});

export default Textarea;
