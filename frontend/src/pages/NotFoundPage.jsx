import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
        <AlertCircle className="w-6 h-6 text-slate-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Resource Not Found</h1>
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6">
        The warehouse view or module endpoint you requested does not exist in the Stockyard ERP core routing.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Return to Operations Dashboard
      </Link>
    </div>
  );
}
