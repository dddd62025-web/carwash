'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getAppUsers, 
  getActiveSessions, 
  getKarcherLock, 
  createWashSession, 
  completeWashSession, 
  WashSession, 
  KarcherLock,
  Job
} from '@/lib/db';
import BrandSelector from '@/components/BrandSelector';
import ServiceChecklist from '@/components/ServiceChecklist';
import { Loader2, LogOut, Car, Info, Settings2, Trash2, CheckCircle2, X } from 'lucide-react';

export default function EmployeePOSPage() {
  const router = useRouter();

  // --- Operator States ---
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>('Employé');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Real-time polled DB states ---
  const [activeSessions, setActiveSessions] = useState<WashSession[]>([]);
  const [karcherLock, setKarcherLock] = useState<KarcherLock | null>(null);

  // --- Bay Local Selection States (When session is NOT active) ---
  
  // Poste 1
  const [p1Brand, setP1Brand] = useState<string | null>(null);

  // Poste 2
  const [p2VehicleType, setP2VehicleType] = useState<string>('Petite voiture');
  const [p2Brand, setP2Brand] = useState<string | null>(null);

  // Poste 3 (Modal state)
  const [isP3Open, setIsP3Open] = useState<boolean>(false);
  const [p3VehicleType, setP3VehicleType] = useState<string>('Moto');

  // --- Fetch employee session & initialize polling ---
  useEffect(() => {
    async function loadActiveEmployee() {
      try {
        setLoading(true);
        // Load local storage session
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
        
        // Fallback to first employee
        const users = await getAppUsers();
        const employee = users.find((user) => user.role === 'employee');
        if (employee) {
          setEmployeeId(employee.id);
          setEmployeeName(employee.name);
        } else {
          setError('Aucun profil d\'employé trouvé. Veuillez insérer un employé dans Supabase.');
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Erreur lors du chargement des informations du terminal.');
      } finally {
        setLoading(false);
      }
    }

    loadActiveEmployee();
  }, []);

  // Poll database for active sessions and Karcher lock every 3 seconds
  useEffect(() => {
    async function fetchPolledData() {
      try {
        const [sessions, lock] = await Promise.all([
          getActiveSessions(),
          getKarcherLock()
        ]);
        setActiveSessions(sessions);
        setKarcherLock(lock);
      } catch (err) {
        console.warn('Polling error (Supabase might be sleeping):', err);
      }
    }

    fetchPolledData(); // run once on mount
    const interval = setInterval(fetchPolledData, 3000);
    return () => clearInterval(interval);
  }, []);

  // --- Actions ---

  const handleLogOut = () => {
    localStorage.removeItem('current_user');
    router.push('/');
  };

  const handleStartSession = async (bay: number, vehicleType: string, jobId: string) => {
    try {
      await createWashSession(bay, vehicleType, jobId);
      // Reset local flow inputs
      if (bay === 1) {
        setP1Brand(null);
      } else if (bay === 2) {
        setP2Brand(null);
      }
      // Re-fetch active sessions immediately
      const sessions = await getActiveSessions();
      setActiveSessions(sessions);
    } catch (err) {
      console.error('Failed to start session:', err);
      alert('Erreur lors du lancement de la session de lavage.');
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      await completeWashSession(sessionId);
      // Re-fetch active sessions immediately
      const sessions = await getActiveSessions();
      setActiveSessions(sessions);
    } catch (err) {
      console.error('Failed to complete session:', err);
      alert('Erreur lors de la clôture de la session de lavage.');
    }
  };

  // Helper selectors
  const sessionP1 = activeSessions.find(s => s.bay === 1);
  const sessionP2 = activeSessions.find(s => s.bay === 2);
  const sessionP3 = activeSessions.find(s => s.bay === 3);

  // Render Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-150 flex flex-col items-center justify-center text-gray-800">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
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

  // Session rendering function (returns JSX card for an active session)
  const renderActiveSessionCard = (session: WashSession) => {
    const isKarcherLockOwned = karcherLock?.locked_by_session_id === session.id;
    const isKarcherLockBusy = karcherLock?.locked_by_session_id && karcherLock.locked_by_session_id !== session.id;
    const karcherBusyBay = karcherLock?.locked_by_bay;

    return (
      <div className="bg-white border-2 border-blue-600 rounded-3xl p-5 shadow-lg flex flex-col justify-between min-h-[360px] space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-3 py-1 rounded-full tracking-wider">
              Lavage en cours
            </span>
            <span className="text-xs text-gray-400 font-extrabold bg-gray-100 px-2 py-1 rounded-lg">
              {new Date(session.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Véhicule enregistré</p>
            <h3 className="text-xl font-black text-gray-900 mt-1 uppercase flex items-center gap-2">
              <Car className="w-5 h-5 text-gray-500 shrink-0" />
              <span>{session.car_brand} ({session.vehicle_type})</span>
            </h3>
          </div>

          {/* Scans Counters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-150 p-3 rounded-2xl text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kärcher Scans</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{session.karcher_activation_count}</p>
            </div>
            
            {session.vehicle_type !== 'Moto' && session.vehicle_type !== 'Tapis' && session.vehicle_type !== 'Tacha' ? (
              <div className="bg-gray-50 border border-gray-150 p-3 rounded-2xl text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Aspirateur Scans</p>
                <p className="text-2xl font-black text-blue-650 mt-1">{session.vacuum_activation_count}</p>
              </div>
            ) : (
              <div className="bg-gray-50/70 border border-dashed border-gray-200 p-3 rounded-2xl flex items-center justify-center text-center">
                <p className="text-xs text-gray-400 italic">Pas d&apos;aspirateur</p>
              </div>
            )}
          </div>

          {/* Karcher Status Lock Indicator */}
          <div className="pt-2">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Statut Kärcher (Partagé)</p>
            {isKarcherLockOwned ? (
              <div className="flex items-center space-x-2 bg-green-50 border border-green-200 p-3 rounded-xl text-green-700 text-xs font-bold">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping shrink-0" />
                <span>Kärcher connecté & actif sur votre poste</span>
              </div>
            ) : isKarcherLockBusy ? (
              <div className="flex items-center space-x-2 bg-amber-50 border border-amber-250 p-3 rounded-xl text-amber-700 text-xs font-bold">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full shrink-0" />
                <span>Occupé par le Poste {karcherBusyBay}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 p-3 rounded-xl text-gray-650 text-xs font-bold">
                <span className="w-2.5 h-2.5 bg-gray-300 rounded-full shrink-0" />
                <span>Libre - Prêt au scan de badge</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => handleCompleteSession(session.id)}
          className="w-full py-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold rounded-2xl text-sm transition-all active:scale-95 shadow-md shadow-red-650/10 flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Terminer le lavage</span>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-600 text-white rounded-lg">
            <Car className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-base sm:text-lg text-gray-900 tracking-tight">
            Terminal POS Station
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => setIsP3Open(true)}
            className="flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs sm:text-sm transition-all active:scale-95 border border-blue-100/50"
          >
            <span>🏍️ Poste 3</span>
            {sessionP3 && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          </button>
          
          <span className="text-xs sm:text-sm font-bold text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-xl hidden xs:inline">
            Opérateur : <span className="text-gray-900 font-extrabold">{employeeName}</span>
          </span>

          <button
            onClick={handleLogOut}
            className="flex items-center space-x-1 py-1.5 px-2.5 sm:px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs sm:text-sm transition-all active:scale-95 border border-red-100/50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Main split dashboard (Poste 1 & Poste 2) */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* === POSTE 1 === */}
        <section className="flex flex-col space-y-4">
          <div className="bg-white border border-gray-200 px-5 py-3 rounded-2xl shadow-sm flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="font-black text-gray-900 text-base">POSTE 1</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Petite voiture uniquement</p>
            </div>
            {!sessionP1 && (
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 py-1 px-3 rounded-full uppercase">
                Petite Voiture
              </span>
            )}
          </div>

          <div className="flex-1">
            {sessionP1 ? (
              renderActiveSessionCard(sessionP1)
            ) : (
              <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm space-y-4">
                {p1Brand === null ? (
                  <BrandSelector 
                    onSelectBrand={(brand) => setP1Brand(brand)} 
                    isCompact={true}
                  />
                ) : (
                  <ServiceChecklist
                    selectedBrand={p1Brand}
                    employeeId={employeeId || ''}
                    onCancel={() => setP1Brand(null)}
                    onSuccess={() => {}}
                    onSuccessWithJob={(job) => handleStartSession(1, 'Petite voiture', job.id)}
                    isCompact={true}
                  />
                )}
              </div>
            )}
          </div>
        </section>

        {/* === POSTE 2 === */}
        <section className="flex flex-col space-y-4">
          <div className="bg-white border border-gray-200 px-5 py-3 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/50 gap-2">
            <div>
              <h2 className="font-black text-gray-900 text-base">POSTE 2</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Petite / Grande / Camion</p>
            </div>
            
            {/* Vehicle Type Dropdown if inactive */}
            {!sessionP2 && (
              <select
                value={p2VehicleType}
                onChange={(e) => {
                  setP2VehicleType(e.target.value);
                  setP2Brand(null); // Reset flow
                }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-extrabold text-gray-800 focus:outline-none focus:border-blue-500"
              >
                <option value="Petite voiture">Petite Voiture</option>
                <option value="Grande voiture">Grande Voiture</option>
                <option value="Camion">Camion</option>
              </select>
            )}
          </div>

          <div className="flex-1">
            {sessionP2 ? (
              renderActiveSessionCard(sessionP2)
            ) : (
              <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm space-y-4">
                {p2Brand === null ? (
                  <BrandSelector 
                    onSelectBrand={(brand) => setP2Brand(brand)} 
                    isCompact={true}
                  />
                ) : (
                  <ServiceChecklist
                    selectedBrand={p2Brand}
                    employeeId={employeeId || ''}
                    onCancel={() => setP2Brand(null)}
                    onSuccess={() => {}}
                    onSuccessWithJob={(job) => handleStartSession(2, p2VehicleType, job.id)}
                    isCompact={true}
                  />
                )}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* === POSTE 3 MODAL (Moto, Tapis, Tacha) === */}
      {isP3Open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <header className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🏍️</span>
                <div>
                  <h3 className="font-black text-gray-900 text-sm sm:text-base">POSTE 3 - Moto / Tapis / Tacha</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Pas de sélection d&apos;aspirateur</p>
                </div>
              </div>
              <button
                onClick={() => setIsP3Open(false)}
                className="p-1 rounded-xl hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {sessionP3 ? (
                // Active session for Poste 3
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Prestation Active</p>
                      <h4 className="text-lg font-black text-blue-900 mt-0.5 uppercase">
                        {sessionP3.vehicle_type}
                      </h4>
                    </div>
                    <span className="text-xs text-gray-500 font-bold">
                      Début : {new Date(sessionP3.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kärcher Scans</p>
                      <p className="text-3xl font-black text-blue-600 mt-1">{sessionP3.karcher_activation_count}</p>
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-center text-center">
                      <p className="text-xs text-gray-450 italic">Aspirateur non disponible</p>
                    </div>
                  </div>

                  {/* Karcher Status Indicator */}
                  <div className="pt-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Statut Kärcher (Partagé)</p>
                    {karcherLock?.locked_by_session_id === sessionP3.id ? (
                      <div className="flex items-center space-x-2 bg-green-50 border border-green-200 p-3 rounded-xl text-green-700 text-xs font-bold">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping shrink-0" />
                        <span>Kärcher connecté & actif sur votre poste</span>
                      </div>
                    ) : karcherLock?.locked_by_session_id ? (
                      <div className="flex items-center space-x-2 bg-amber-50 border border-amber-250 p-3 rounded-xl text-amber-700 text-xs font-bold">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full shrink-0" />
                        <span>Occupé par le Poste {karcherLock.locked_by_bay}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 p-3 rounded-xl text-gray-650 text-xs font-bold">
                        <span className="w-2.5 h-2.5 bg-gray-300 rounded-full shrink-0" />
                        <span>Libre - Prêt au scan de badge</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleCompleteSession(sessionP3.id)}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold rounded-xl text-sm transition-all active:scale-95 shadow-md flex items-center justify-center space-x-2 cursor-pointer mt-4"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Terminer le lavage</span>
                  </button>
                </div>
              ) : (
                // Inactive: selector & services
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-50 p-3.5 rounded-2xl border border-gray-150">
                    <span className="text-xs font-bold text-gray-500 uppercase">Type de lavage :</span>
                    <select
                      value={p3VehicleType}
                      onChange={(e) => setP3VehicleType(e.target.value)}
                      className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-extrabold text-gray-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Moto">Moto</option>
                      <option value="Tapis">Tapis</option>
                      <option value="Tacha">Tacha</option>
                    </select>
                  </div>

                  {/* Inline simplified checklist, selectedBrand is defaulted to p3VehicleType */}
                  <ServiceChecklist
                    selectedBrand={p3VehicleType}
                    employeeId={employeeId || ''}
                    onCancel={() => setIsP3Open(false)}
                    onSuccess={() => {}}
                    onSuccessWithJob={(job) => {
                      handleStartSession(3, p3VehicleType, job.id);
                      // keep modal open to show active session
                    }}
                    isCompact={true}
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
