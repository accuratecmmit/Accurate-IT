import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateFilterPreset = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

export interface DateFilterState {
  preset: DateFilterPreset;
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  filter: DateFilterState;
  onChange: (newFilter: DateFilterState) => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ filter, onChange, className = '' }) => {
  const presets: { id: DateFilterPreset; label: string }[] = [
    { id: 'ALL', label: 'All Time' },
    { id: 'TODAY', label: 'Today' },
    { id: 'THIS_WEEK', label: 'This Week' },
    { id: 'THIS_MONTH', label: 'This Month' },
    { id: 'LAST_MONTH', label: 'Last Month' },
    { id: 'CUSTOM', label: 'Custom' },
  ];

  const handlePresetClick = (preset: DateFilterPreset) => {
    if (preset === 'CUSTOM') {
      const today = new Date().toISOString().split('T')[0];
      onChange({
        preset: 'CUSTOM',
        startDate: filter.startDate || today,
        endDate: filter.endDate || today,
      });
    } else {
      onChange({
        preset,
        startDate: '',
        endDate: '',
      });
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Preset Pills */}
      <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
        {presets.map((p) => {
          const isActive = filter.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetClick(p.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Pickers */}
      {filter.preset === 'CUSTOM' && (
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl shadow-sm text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400">From:</label>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => onChange({ ...filter, startDate: e.target.value })}
              className="bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:outline-none text-xs font-medium cursor-pointer"
            />
          </div>
          <span className="text-slate-300 dark:text-slate-600">→</span>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400">To:</label>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => onChange({ ...filter, endDate: e.target.value })}
              className="bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:outline-none text-xs font-medium cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
