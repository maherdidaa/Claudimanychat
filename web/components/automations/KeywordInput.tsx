'use client';

import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface KeywordInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  error?: string;
}

export function KeywordInput({ label, values, onChange, placeholder, error }: KeywordInputProps) {
  const [draft, setDraft] = useState('');

  const addKeyword = () => {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg border bg-white px-2 py-2 dark:bg-slate-900 ${
          error ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        {values.map((kw) => (
          <span
            key={kw}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-700/20 dark:text-brand-500"
          >
            {kw}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== kw))}
              className="text-brand-500 hover:text-brand-700"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addKeyword}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
