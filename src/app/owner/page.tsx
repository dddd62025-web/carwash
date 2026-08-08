'use client';

import React, { useState, useEffect } from 'react';
import { 
  getTodayRevenue, 
  getRevenueInRange, 
  getRecentJobs, 
  getAllWashSessionsWithAlerts,
  getActivationsForSession,
  acknowledgeAlert,
  RecentJobView,
  WashSession,
  Activation
} from '@/lib/db';
import { 
  Landmark, 
  Clock, 
  Car, 
  ClipboardList, 
  Filter, 
  AlertOctagon, 
  Check, 
  Loader2, 
  X, 
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function OwnerDashboardPage() {
  // --- User Profile ---
  const [userRole, setUserRole] = useState<string>('employee');

  // --- Filtering States ---
  const [period, setPeriod] = useState<string>('jour');
  const [customDate, setCustomDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // --- Dashboard Data States ---
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  const [periodRevenue, setPeriodRevenue] = useState<number>(0);
  const [recentJobs, setRecentJobs] = useState<RecentJobView[]>([]);
  const [alertSessions, setAlertSessions] = useState<WashSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // --- Modal Detail States ---
  const [selectedSession, setSelectedSession] = useState<WashSession | null>(null);
  const [selectedJob, setSelectedJob] = useState<RecentJobView | null>(null);
  const [activationsLog, setActivationsLog] = useState<Activation[]>([]);
  const [loadingActivations, setLoadingActivations] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  // Acknowledge sub-saving state
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Helper to compute date range strings
  const getDateRange = (selectedPeriod: string, dateStr: string) => {
    const start = new Date();
    const end = new Date();
    
    if (selectedPeriod === 'jour') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === 'semaine') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === 'mois') {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === 'custom' && dateStr) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      start.setFullYear(year, month, day);
      start.setHours(0, 0, 0, 0);
      
      end.setFullYear(year, month, day);
      end.setHours(23, 59, 59, 999);
    }
    
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  };

  // Fetch operator session info on mount
  useEffect(() => {
    const sessionStr = localStorage.getItem('current_user');
    if (sessionStr) {
      try {
        const u = JSON.parse(sessionStr);
        setUserRole(u.role || 'employee');
      } catch (e) {
        console.error('Failed to parse current user session:', e);
      }
    }
  }, []);

  // Fetch all dashboard indicators
  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      
      // 1. Fetch Today Revenue (fixed 24h start-of-day interval)
      const todayRange = getDateRange('jour', '');
      const todayRev = await getRevenueInRange(todayRange.start, todayRange.end);
      setTodayRevenue(todayRev);
      
      // 2. Fetch Period Revenue & recent jobs list
      const range = getDateRange(period, customDate);
      const pRev = await getRevenueInRange(range.start, range.end);
      setPeriodRevenue(pRev);
      
      const jobs = await getRecentJobs(range.start, range.end);
      setRecentJobs(jobs);
      
      // 3. Fetch Alert sessions
      const alerts = await getAllWashSessionsWithAlerts();
      setAlertSessions(alerts);

    } catch (err) {
      console.error('Error fetching dashboard datasets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload data when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [period, customDate]);

  // Handle Alert Acknowledgment
  const handleAcknowledgeAlert = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // prevent modal trigger
    
    setAcknowledgingId(sessionId);
    try {
      await acknowledgeAlert(sessionId);
      
      // If modal detail is currently viewing this session, update it
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, alert_acknowledged: true } : null);
      }
      
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      alert('Erreur lors de l\'acquittement de l\'alerte.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Open activations detail popup
  const handleRowClick = async (job: RecentJobView) => {
    if (!job.session_id) return; // No linked physical wash session
    
    setSelectedJob(job);
    setIsModalOpen(true);
    setLoadingActivations(true);

    try {
      // Find corresponding session details
      const match = alertSessions.find(s => s.id === job.session_id) || {
        id: job.session_id,
        bay: 0,
        vehicle_type: 'Inconnu',
        status: 'completed',
        karcher_activation_count: 0,
        vacuum_activation_count: 0,
        alert_triggered: job.alert_triggered || false,
        alert_acknowledged: false,
        created_at: job.created_at,
        completed_at: null
      } as WashSession;

      setSelectedSession(match);
      
      // Fetch activations details
      const log = await getActivationsForSession(job.session_id);
      setActivationsLog(log);
    } catch (err) {
      console.error('Failed to load session activations:', err);
    } finally {
      setLoadingActivations(false);
    }
  };

  // Date formatting helpers
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  const getDurationString = (start: string, end: string | null) => {
    if (!end) return 'En cours...';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffSec = Math.round(diffMs / 1000);
    return `${diffSec}s`;
  };

  // Calculate unacknowledged active alerts
  const activeAlerts = alertSessions.filter(s => s.alert_triggered && !s.alert_acknowledged);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center text-gray-800">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-semibold text-sm">Chargement des données du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8 text-gray-800">
      
      {/* HEADER SECTION WITH FILTER SELECTOR */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-950 flex items-center gap-2">
            <span>Dashboard Directeur</span>
            {refreshing && <Loader2 className="w-4.5 h-4.5 animate-spin text-blue-600" />}
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Suivi en temps réel des ventes, alertes et activations.</p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 p-2 rounded-2xl shadow-sm">
          <div className="flex items-center space-x-1 text-gray-400 px-2">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Période :</span>
          </div>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-gray-50 border border-gray-250 rounded-xl px-3 py-1.5 text-xs font-extrabold text-gray-800 focus:outline-none focus:border-blue-500"
          >
            <option value="jour">Aujourd&apos;hui (24h)</option>
            <option value="semaine">7 Derniers jours</option>
            <option value="mois">30 Derniers jours</option>
            <option value="custom">Jour spécifique</option>
          </select>

          {period === 'custom' && (
            <div className="flex items-center space-x-1.5 animate-in slide-in-from-right-3 duration-150">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-gray-50 border border-gray-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-800 focus:outline-none"
              />
            </div>
          )}
        </div>
      </header>

      {/* ALERT BANNERS MATRIX (Centre d'alertes) */}
      {activeAlerts.length > 0 && (
        <section className="bg-red-50 border-2 border-red-200 rounded-3xl p-5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-red-200 pb-3">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertOctagon className="w-5.5 h-5.5 animate-bounce shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base">
                Centre d&apos;Alertes ({activeAlerts.length} en attente)
              </h3>
            </div>
            <span className="text-[10px] font-black bg-red-650 text-white px-2.5 py-1 rounded-full uppercase">
              Seuils Dépassés
            </span>
          </div>

          {/* List of active alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-48 overflow-y-auto pr-1">
            {activeAlerts.map((session) => {
              const isOwner = userRole === 'owner';
              const isCompleted = session.status === 'completed';
              const isSaving = acknowledgingId === session.id;

              return (
                <div 
                  key={session.id} 
                  className="bg-white border border-red-100/80 p-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm hover:border-red-200 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-extrabold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        Poste {session.bay}
                      </span>
                      <span className="text-xs font-black text-gray-900 uppercase">
                        {session.car_brand || 'Véhicule'} ({session.vehicle_type})
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-semibold">
                      Scans : <span className="text-red-600 font-bold">{session.karcher_activation_count} Kärcher</span> (seuil 5) • <span className="text-red-600 font-bold">{session.vacuum_activation_count} Aspirateur</span> (seuil 3)
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      Statut : {isCompleted ? 'Terminé (Prêt à l\'acquittement)' : 'Actif (En cours de lavage)'}
                    </p>
                  </div>

                  {/* Acknowledge Button */}
                  {isOwner && (
                    <button
                      onClick={(e) => handleAcknowledgeAlert(session.id, e)}
                      disabled={!isCompleted || isSaving}
                      className="w-full sm:w-auto py-2 px-3.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 active:scale-95 shadow-sm cursor-pointer shrink-0"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Acquitter</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI METRICS (Side-by-side Revenue Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Today's Revenue Widget */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm flex items-center justify-between overflow-hidden">
          <div className="space-y-1.5">
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Revenus Aujourd&apos;hui</p>
            <h2 className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
              {todayRevenue.toFixed(2)} <span className="text-sm font-bold">DT</span>
            </h2>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <Landmark className="w-6 h-6" />
          </div>
        </div>

        {/* Selected Period's Revenue Widget */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm flex items-center justify-between overflow-hidden">
          <div className="space-y-1.5">
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Revenus Période ({period === 'jour' ? 'Jour' : period === 'semaine' ? 'Semaine' : period === 'mois' ? 'Mois' : 'Perso'})
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-blue-650 tracking-tight">
              {periodRevenue.toFixed(2)} <span className="text-sm font-bold">DT</span>
            </h2>
          </div>
          <div className="p-3 bg-blue-55 text-blue-650 rounded-2xl shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Total washed cars Widget */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm flex items-center justify-between overflow-hidden">
          <div className="space-y-1.5">
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Voitures Lavées (Période)</p>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {recentJobs.length} <span className="text-xs font-bold text-gray-400">lavages</span>
            </h2>
          </div>
          <div className="p-3 bg-gray-50 text-gray-500 rounded-2xl shrink-0">
            <Car className="w-6 h-6" />
          </div>
        </div>

      </section>

      {/* RECENT ACTIVITY TABLE */}
      <section className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
        
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900 flex items-center space-x-2">
            <ClipboardList className="w-4.5 h-4.5 text-gray-500" />
            <span>Historique & Activité Récente</span>
          </h3>
          <span className="text-[10px] text-gray-450 font-bold">
            Cliquez sur un lavage pour inspecter les scans vidéo
          </span>
        </div>

        <div className="overflow-x-auto">
          {recentJobs.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400 text-sm">
              <Car className="w-10 h-10 text-gray-350 mb-2 stroke-[1.5]" />
              <p>Aucun lavage enregistré pour cette période.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 text-[10px] sm:text-xs font-extrabold uppercase">
                  <th className="px-5 py-3.5">Heure / Date</th>
                  <th className="px-5 py-3.5">Marque</th>
                  <th className="px-5 py-3.5">Employé</th>
                  <th className="px-5 py-3.5">Prestations</th>
                  <th className="px-5 py-3.5 text-right">Montant</th>
                  <th className="px-5 py-3.5 text-center">Scans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-xs sm:text-sm">
                {recentJobs.map((job) => {
                  const hasAlert = job.alert_triggered;
                  return (
                    <tr 
                      key={job.id} 
                      onClick={() => handleRowClick(job)}
                      className={`cursor-pointer transition-colors ${
                        hasAlert 
                          ? 'bg-red-50 hover:bg-red-100 text-red-950 border-red-200' 
                          : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Clock className={`w-4 h-4 shrink-0 ${hasAlert ? 'text-red-500' : 'text-gray-400'}`} />
                          <div>
                            <p className="font-extrabold">{formatTime(job.created_at)}</p>
                            <p className="text-[9px] text-gray-450 mt-0.5">{formatDate(job.created_at)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${
                          hasAlert 
                            ? 'bg-red-100 text-red-800 border-red-250' 
                            : 'bg-blue-50 text-blue-800 border-blue-100'
                        }`}>
                          {job.car_brand}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-bold">
                        {job.employee_name}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-650">
                        <div className="flex flex-wrap gap-1 max-w-xs sm:max-w-md">
                          {job.services.map((svc: string, i: number) => (
                            <span
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded-md ${
                                hasAlert ? 'bg-red-150/50 text-red-900 font-bold' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-right whitespace-nowrap font-black text-sm ${hasAlert ? 'text-red-700' : 'text-blue-600'}`}>
                        {job.total_amount.toFixed(2)} <span className="text-[10px] font-bold">DT</span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {job.session_id ? (
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                            hasAlert ? 'bg-red-200 text-red-900 border-red-300 animate-pulse' : 'bg-green-50 text-green-800 border-green-200'
                          }`}>
                            <span>Inspecter</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-350 italic">Aucun scan</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* DETAILED ACTIVATIONS POPUP MODAL */}
      {isModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-left">
            
            {/* Modal Header */}
            <header className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5.5 h-5.5 text-blue-600 shrink-0" />
                <div>
                  <h3 className="font-black text-gray-900 text-sm sm:text-base">Corrélation Vidéo & Historique Scans</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Véhicule : <span className="text-gray-900 font-black">{selectedJob.car_brand}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl hover:bg-gray-200 text-gray-400 hover:text-gray-650 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              
              {/* Session Meta */}
              {selectedSession && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Poste Physique</span>
                    <p className="text-sm font-extrabold text-gray-900 mt-0.5">Poste {selectedSession.bay || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Gabarit</span>
                    <p className="text-sm font-extrabold text-gray-900 mt-0.5">{selectedSession.vehicle_type}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Statut Session</span>
                    <p className="text-sm font-extrabold text-gray-900 mt-0.5 capitalize">{selectedSession.status}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Alerte</span>
                    {selectedSession.alert_triggered ? (
                      <p className={`text-xs font-black px-2 py-0.5 rounded-full text-center mt-1 shrink-0 ${
                        selectedSession.alert_acknowledged ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800 animate-pulse'
                      }`}>
                        {selectedSession.alert_acknowledged ? 'Acquittée' : 'Déclenchée'}
                      </p>
                    ) : (
                      <p className="text-xs font-extrabold text-green-700 mt-1">Aucune</p>
                    )}
                  </div>
                </div>
              )}

              {/* Alert action in modal */}
              {selectedSession && selectedSession.alert_triggered && !selectedSession.alert_acknowledged && (
                <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-red-950 font-semibold">
                    Seuils d&apos;activations dépassés (Kärcher {selectedSession.karcher_activation_count}/5 • Aspirateur {selectedSession.vacuum_activation_count}/3).
                  </div>
                  {userRole === 'owner' && (
                    <button
                      onClick={() => handleAcknowledgeAlert(selectedSession.id)}
                      disabled={selectedSession.status !== 'completed' || acknowledgingId !== null}
                      className="w-full sm:w-auto py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 active:scale-95 cursor-pointer"
                    >
                      {acknowledgingId === selectedSession.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Acquitter l&apos;alerte</span>
                    </button>
                  )}
                </div>
              )}

              {/* Activations Log Table */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider">Journal Chronologique des Activations</h4>
                
                {loadingActivations ? (
                  <div className="py-12 flex justify-center items-center">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  </div>
                ) : activationsLog.length === 0 ? (
                  <div className="py-8 bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 text-xs sm:text-sm">
                    <Clock className="w-7 h-7 mb-1.5 text-gray-300" />
                    <span>Aucun scan physique n&apos;a été détecté pour cette session.</span>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 text-[10px] font-extrabold uppercase">
                          <th className="px-4 py-2.5 text-center">N°</th>
                          <th className="px-4 py-2.5">Ressource</th>
                          <th className="px-4 py-2.5">Début</th>
                          <th className="px-4 py-2.5">Fin</th>
                          <th className="px-4 py-2.5 text-right">Durée Planifiée</th>
                          <th className="px-4 py-2.5 text-right">Durée Réelle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-155 text-xs text-gray-700">
                        {activationsLog.map((act) => (
                          <tr key={act.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-bold text-center text-gray-500">{act.sequence_number}</td>
                            <td className="px-4 py-3 whitespace-nowrap uppercase font-extrabold text-gray-900">
                              {act.resource === 'karcher' ? (
                                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Kärcher</span>
                              ) : (
                                <span className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                  Aspirateur {act.resource.slice(-1)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatTime(act.start_time)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {act.end_time ? formatTime(act.end_time) : <span className="text-green-600 font-extrabold animate-pulse">En cours</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-500">{act.duration_planned_seconds}s</td>
                            <td className="px-4 py-3 text-right font-black text-gray-900">
                              {getDurationString(act.start_time, act.end_time)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions */}
            <footer className="bg-gray-50 px-5 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="py-2.5 px-6 bg-white border border-gray-250 hover:bg-gray-100 text-gray-700 font-extrabold rounded-xl text-xs transition-colors active:scale-95 cursor-pointer"
              >
                Fermer
              </button>
            </footer>

          </div>
        </div>
      )}

    </div>
  );
}
