import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-amber-600 mb-6">
        <Compass className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Page Not Found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-2 mb-8 leading-relaxed">
        The warehouse view or module endpoint you requested does not exist in the Stockyard ledger.
      </p>
      <Link to="/">
        <Button variant="primary" icon={ArrowLeft}>
          Return to Operations Dashboard
        </Button>
      </Link>
    </div>
  );
}
