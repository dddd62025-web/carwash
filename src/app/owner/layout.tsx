import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Settings, Home, Car } from 'lucide-react';

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col text-gray-800">
      
      {/* Owner Top Navigation Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 gap-2">
            
            {/* Logo */}
            <div className="flex items-center space-x-2 shrink-0">
              <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                <Car className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-sm sm:text-base text-gray-900 tracking-tight">
                Portail Gérant
              </span>
            </div>

            {/* Menu Links */}
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1">
              <Link
                href="/owner"
                className="flex items-center space-x-1 py-1.5 px-2.5 sm:px-4 rounded-xl hover:bg-gray-100 font-bold text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition-all active:scale-95 shrink-0"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              
              <Link
                href="/owner/settings"
                className="flex items-center space-x-1 py-1.5 px-2.5 sm:px-4 rounded-xl hover:bg-gray-100 font-bold text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition-all active:scale-95 shrink-0"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Tarifs</span>
                <span className="xs:hidden">Tarifs</span>
              </Link>
              
              <Link
                href="/"
                className="flex items-center space-x-1 py-1.5 px-2.5 sm:px-4 rounded-xl hover:bg-red-50 text-red-600 hover:text-red-700 font-bold text-xs sm:text-sm transition-all active:scale-95 border border-transparent hover:border-red-100 shrink-0"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Quitter</span>
              </Link>
            </div>

          </div>
        </div>
      </nav>

      {/* Main Section */}
      <div className="flex-1">
        {children}
      </div>
      
    </div>
  );
}
