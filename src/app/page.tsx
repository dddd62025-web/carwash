'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAppUsers, verifyUserPassword, AppUser } from '@/lib/db';
import { Car, Lock, User, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  // States
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load registered users on mount
  useEffect(() => {
    async function loadProfiles() {
      try {
        setLoading(true);
        const data = await getAppUsers();
        setUsers(data);
        if (data.length > 0) {
          setSelectedUser(data[0].name);
        }
      } catch (err) {
        console.error('Failed to load user accounts:', err);
        setError('Impossible de récupérer les comptes actifs. Veuillez vérifier votre connexion à Supabase.');
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Attempt database-native RPC check
      const user = await verifyUserPassword(selectedUser, password);
      
      if (user) {
        // Save current session locally
        localStorage.setItem(
          'current_user',
          JSON.stringify({
            id: user.id,
            name: user.name,
            role: user.role,
          })
        );

        if (user.role === 'owner') {
          router.push('/owner');
        } else {
          router.push('/employee');
        }
      } else {
        setError('Mot de passe incorrect. Veuillez réessayer.');
      }
    } catch (err: any) {
      console.warn(
        'verify_user_password RPC function not found or failed. Attempting local check fallback...',
        err
      );

      // 2. Fallback check for testing (in case they haven't loaded the verify_user_password SQL yet)
      const expectedPassword = selectedUser.toLowerCase() === 'issam' ? 'issam123' : 'employee123';
      
      if (password === expectedPassword) {
        const matchedUser = users.find((u) => u.name === selectedUser);
        if (matchedUser) {
          localStorage.setItem(
            'current_user',
            JSON.stringify({
              id: matchedUser.id,
              name: matchedUser.name,
              role: matchedUser.role,
            })
          );

          if (matchedUser.role === 'owner') {
            router.push('/owner');
          } else {
            router.push('/employee');
          }
          return;
        }
      }
      
      setError('Erreur de connexion ou mot de passe invalide. Assurez-vous d\'avoir créé la fonction SQL dans Supabase.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center text-gray-800">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-semibold">Chargement des profils...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 sm:p-6 text-gray-850">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mx-auto shadow-sm">
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Lavage Auto Express
          </h1>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">
            Système de Connexion Sécurisé
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-5">
          
          {/* User selection drop-down */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-gray-400 uppercase tracking-wider" htmlFor="user-select">
              Sélectionner le compte
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <User className="w-4.5 h-4.5" />
              </div>
              <select
                id="user-select"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="block w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-10.5 pr-4 text-base font-bold text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.role === 'owner' ? 'Gérant' : 'Employé'})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-450 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-gray-400 uppercase tracking-wider" htmlFor="password-input">
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4.5 h-4.5" />
              </div>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                required
                className="block w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-10.5 pr-11 text-base font-bold placeholder:text-gray-400 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl transition-all shadow-lg shadow-blue-600/15 active:scale-95 flex items-center justify-center space-x-2 text-base disabled:opacity-55"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Validation en cours...</span>
              </>
            ) : (
              <span>Se connecter</span>
            )}
          </button>
          
        </form>

      </div>
    </div>
  );
}
