'use client';

import React, { useState, useEffect } from 'react';
import { getServices, updateServicePrice, Service } from '@/lib/db';
import { Loader2, Save, CheckCircle, AlertTriangle } from 'lucide-react';

export default function PricingSettingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [prices, setPrices] = useState<{ [id: number]: string }>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadPricing() {
    try {
      setLoading(true);
      const data = await getServices();
      setServices(data);
      
      const priceState: { [id: number]: string } = {};
      data.forEach((s) => {
        priceState[s.id] = s.price.toFixed(2);
      });
      setPrices(priceState);
    } catch (err) {
      console.error('Failed to load services:', err);
      setErrorMsg('Impossible de charger les prestations depuis la base de données.');
    } finally {
      setLoading(false);
    }
  }

  // Load Pricing on mount
  useEffect(() => {
    loadPricing();
  }, []);

  const handlePriceChange = (id: number, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrices((prev) => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  const handleSavePrice = async (id: number, name: string) => {
    const inputVal = prices[id];
    const newPrice = parseFloat(inputVal);

    if (isNaN(newPrice) || newPrice < 0) {
      setErrorMsg(`Veuillez entrer un tarif valide pour "${name}"`);
      return;
    }

    setSavingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await updateServicePrice(id, newPrice);
      setSuccessMsg(`Le tarif de "${name}" a été mis à jour à ${newPrice.toFixed(2)} DT`);
      
      // Re-fetch list to sync UI with DB
      const updatedServices = await getServices();
      setServices(updatedServices);
      
      const newPriceState: { [id: number]: string } = {};
      updatedServices.forEach((s) => {
        newPriceState[s.id] = s.price.toFixed(2);
      });
      setPrices(newPriceState);

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to update service price:', err);
      setErrorMsg(`Échec de la mise à jour du tarif de "${name}". Vérifiez votre connexion.`);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px] text-gray-800">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-semibold text-sm">Chargement des tarifs de lavage...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 text-gray-800">
      
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950">Ajustement des tarifs</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Modifier les prix de vente appliqués pour les prestations de lavage.</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl text-xs sm:text-sm font-semibold flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs sm:text-sm font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Services List Form Container */}
      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
        
        <div className="border-b border-gray-150 pb-3">
          <h3 className="font-extrabold text-gray-400 text-xs uppercase tracking-wider">Grille des Tarifs de Lavage</h3>
        </div>

        <div className="space-y-4 pt-2">
          {services.map((service) => {
            const isSaving = savingId === service.id;
            return (
              <div 
                key={service.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200 gap-3 sm:gap-4"
              >
                <div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base">{service.name}</h4>
                  <span className="text-[9px] sm:text-[10px] bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded-full mt-1 inline-block">
                    Code Prestation : #{service.id}
                  </span>
                </div>

                <div className="flex items-center space-x-3 justify-between sm:justify-end w-full sm:w-auto">
                  
                  {/* Number Input wrapper */}
                  <div className="relative rounded-xl shadow-sm max-w-[120px] sm:max-w-[140px] flex-1 sm:flex-none">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-400 text-xs font-bold">DT</span>
                    </div>
                    <input
                      type="text"
                      name={`price_${service.id}`}
                      value={prices[service.id] || ''}
                      onChange={(e) => handlePriceChange(service.id, e.target.value)}
                      className="block w-full rounded-xl border border-gray-300 bg-white py-2 sm:py-2.5 pl-9 pr-3 text-xs sm:text-sm font-extrabold text-blue-650 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-right"
                      placeholder="0.00"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Save Price Button */}
                  <button
                    type="button"
                    onClick={() => handleSavePrice(service.id, service.name)}
                    disabled={isSaving}
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 active:scale-95 shadow-sm shrink-0"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Enregistrer</span>
                  </button>

                </div>

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}
