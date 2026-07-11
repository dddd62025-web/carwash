import React from 'react';
import { getTodayRevenue, getRecentJobs } from '@/lib/db';
import { Landmark, Clock, Car, ClipboardList } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OwnerDashboardPage() {
  // Fetch data directly on the server
  let revenue = 0;
  let recentJobs: any[] = [];
  let errorMsg = null;

  try {
    const [todayRevenue, jobs] = await Promise.all([
      getTodayRevenue(),
      getRecentJobs()
    ]);
    revenue = todayRevenue;
    recentJobs = jobs;
  } catch (err) {
    console.error('Error fetching dashboard data on Server Component:', err);
    errorMsg = 'Impossible de charger les indicateurs de suivi. Veuillez vérifier la connexion Supabase.';
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8 text-gray-800">
      
      {/* Welcome & Error Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950">Tableau de bord</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Suivi du chiffre d&apos;affaires et des activités en temps réel.</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs sm:text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {/* KPI Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Today's Revenue Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1 sm:space-y-2">
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Chiffre d&apos;affaires aujourd&apos;hui</p>
            <h2 className="text-2xl sm:text-4xl font-black text-blue-600 tracking-tight">
              {revenue.toFixed(2)} <span className="text-sm sm:text-xl font-bold">DT</span>
            </h2>
          </div>
          <div className="p-3 sm:p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
            <Landmark className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        {/* Total washed cars Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1 sm:space-y-2">
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Voitures Lavées</p>
            <h2 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
              {recentJobs.length} <span className="text-sm sm:text-base font-semibold text-gray-400">Total</span>
            </h2>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 text-gray-500 rounded-2xl shadow-sm">
            <Car className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

      </section>

      {/* Recent Activity Table section */}
      <section className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
        
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900 flex items-center space-x-2">
            <ClipboardList className="w-4.5 h-4.5 text-gray-550" />
            <span>Activité Récente</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          {recentJobs.length === 0 ? (
            <div className="p-12 sm:p-16 flex flex-col items-center justify-center text-gray-400 text-xs sm:text-sm">
              <Car className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mb-3 stroke-[1.5]" />
              <p>Aucun lavage enregistré pour le moment.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-55/40 border-b border-gray-200 text-gray-400 text-[10px] sm:text-xs font-extrabold uppercase">
                  <th className="px-4 sm:px-6 py-3.5">Heure / Date</th>
                  <th className="px-4 sm:px-6 py-3.5">Marque</th>
                  <th className="px-4 sm:px-6 py-3.5">Prestations</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-xs sm:text-sm">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="font-bold text-gray-900">{formatTime(job.created_at)}</p>
                          <p className="text-[10px] text-gray-450 mt-0.5">{formatDate(job.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-100 uppercase">
                        {job.car_brand}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-gray-600 font-medium">
                      {job.services && job.services.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs sm:max-w-md">
                          {job.services.map((svc: string, i: number) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 bg-gray-100 rounded-md text-gray-700 font-semibold"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="italic text-gray-300">Aucune prestation</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right whitespace-nowrap font-black text-blue-600 text-sm sm:text-base">
                      {job.total_amount.toFixed(2)} <span className="text-xs font-bold">DT</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

    </div>
  );
}
