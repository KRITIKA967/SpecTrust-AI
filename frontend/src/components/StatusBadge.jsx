import React from 'react';

export default function StatusBadge({ status }) {
  if (status === 'loading') {
    return (
      <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 animate-pulse mr-2.5"></span>
        Checking Backend Connection...
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-950/40">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute mr-2.5 inline-flex opacity-75"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative mr-2.5"></span>
        Backend Status: Connected
      </div>
    );
  }

  return (
    <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/30 shadow-lg shadow-rose-950/40">
      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative mr-2.5"></span>
      Backend Status: Disconnected
    </div>
  );
}
