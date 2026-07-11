'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAppUsers } from '@/lib/db';
import BrandSelector from '@/components/BrandSelector';
import ServiceChecklist from '@/components/ServiceChecklist';
import { Loader2, LogOut, Car } from 'lucide-react';

export default function EmployeePOSPage() {
  const router = useRouter();

  // States
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>('Employé');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch employee session or default operator on mount
  useEffect(() => {
    async function loadActiveEmployee() {
      try {
        setLoading(true);
        
        // 1. Read from localStorage session first
        const sessionStr = localStorage.getItem('current_user');
        if (sessionStr) {
          try {
            const user = JSON.parse(sessionStr);
            if (user && user.role === 'employee' && user.id) {
              setEmployeeId(user.id);
              setEmployeeName(user.name);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Failed to parse session:', e);
          }
        }

        // 2. Database query fallback
        const users = await getAppUsers();
        
        // Find the first user with 'employee' role
        const employee = users.find((user) => user.role === 'employee');
        
        if (employee) {
          setEmployeeId(employee.id);
          setEmployeeName(employee.name);
        } else {
          setError('Aucun profil d\'employé trouvé dans la table app_users (le rôle doit être "employee"). Veuillez insérer un compte employé dans votre console Supabase.');
        }
      } catch (err) {
        console.error('Failed to load employee details:', err);
        setError('Erreur de connexion à la base de données. Impossible de charger l\'employé actif.');
      } finally {
        setLoading(false);
      }
    }

    loadActiveEmployee();
  }, []);

  const handleLogOut = () => {
    localStorage.removeItem('current_user');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-150 flex flex-col items-center justify-center text-gray-800">
        <Loader2 className="w-10 h-10 text-blue-650 animate-spin mb-4" />
        <p className="text-gray-500 font-semibold text-sm">Initialisation du terminal POS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-150 flex flex-col items-center justify-center p-4 text-gray-800">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4">
          <p className="text-red-600 font-black text-lg">Échec de l&apos;initialisation</p>
          <p className="text-gray-500 text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-md active:scale-95"
          >
            Réessayer la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Header showing current operator and Logout button */}
      {selectedBrand === null && (
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
              <Car className="w-5 h-5 animate-pulse" />
            </div>
            <span className="font-extrabold text-base sm:text-lg text-gray-900 tracking-tight">
              Terminal POS
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-xs sm:text-sm font-bold text-gray-500 bg-gray-100 px-2.5 sm:px-3 py-1.5 rounded-xl truncate max-w-[140px] sm:max-w-none">
              Opérateur : <span className="text-gray-900 font-extrabold">{employeeName}</span>
            </span>
            <button
              onClick={handleLogOut}
              className="flex items-center space-x-1 py-1.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-750 font-bold text-xs sm:text-sm transition-all active:scale-95 border border-red-100/50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>
      )}

      {selectedBrand === null ? (
        <BrandSelector onSelectBrand={(brand) => setSelectedBrand(brand)} />
      ) : (
        <ServiceChecklist
          selectedBrand={selectedBrand}
          employeeId={employeeId || ''}
          onCancel={() => setSelectedBrand(null)}
          onSuccess={() => setSelectedBrand(null)}
        />
      )}
    </div>
  );
}
