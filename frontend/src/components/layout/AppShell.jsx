import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f] font-sans relative selection:bg-amber-100 selection:text-amber-900">
      {/* Apple-style subtle ambient background glow for glass depth */}
      <div 
        className="fixed top-[-10%] right-[15%] w-[650px] h-[650px] rounded-full bg-amber-100/40 blur-[140px] pointer-events-none -z-10" 
        aria-hidden="true"
      />
      <div 
        className="fixed bottom-[-10%] left-[5%] w-[500px] h-[500px] rounded-full bg-slate-200/40 blur-[150px] pointer-events-none -z-10" 
        aria-hidden="true"
      />

      {/* macOS-style Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Apple-style Frosted Glass Top Header */}
        <Header />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
