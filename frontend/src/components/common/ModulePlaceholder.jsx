import React from 'react';
import { Database, Clock, Layers } from 'lucide-react';

export default function ModulePlaceholder({ title, description, table, phase, icon: Icon, schemaFields = [] }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {Icon && <Icon className="w-5 h-5 text-blue-600" />}
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          </div>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Scheduled for {phase}
          </span>
        </div>
      </div>

      {/* Schema Foundation Card */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Database Table Definition: <code className="text-blue-600 font-mono normal-case">{table}</code>
            </h3>
          </div>
          <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
            PostgreSQL 18 Ready
          </span>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          The underlying relational table structure, foreign keys, and indexes have been established in migration <code className="font-mono text-slate-800">001_initial_schema.sql</code>. Business logic and UI interactions will connect to this foundation during the next implementation phase.
        </p>

        {schemaFields.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-2 px-3">Column</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Constraints</th>
                  <th className="py-2 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {schemaFields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-semibold text-slate-800">{field.name}</td>
                    <td className="py-2 px-3 text-blue-600">{field.type}</td>
                    <td className="py-2 px-3 text-slate-500">{field.constraints}</td>
                    <td className="py-2 px-3 text-slate-600 font-sans text-xs">{field.desc}</td>
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
