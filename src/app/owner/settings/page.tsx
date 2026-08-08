'use client';

import React, { useState, useEffect } from 'react';
import { 
  getServices, 
  updateServicePrice, 
  getVehicleTypeConfigs, 
  updateVehicleTypeConfig, 
  Service, 
  VehicleTypeConfig 
} from '@/lib/db';
import { Loader2, Save, CheckCircle, AlertTriangle, Clock, Landmark } from 'lucide-react';

export default function PricingSettingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [vehicleConfigs, setVehicleConfigs] = useState<VehicleTypeConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Service price states
  const [prices, setPrices] = useState<{ [id: number]: string }>({});
  const [savingServiceId, setSavingServiceId] = useState<number | null>(null);

  // Vehicle configs duration states
  const [configsState, setConfigsState] = useState<{
    [type: string]: {
      karcher_initial: string;
      karcher_extension: string;
      vacuum_initial: string;
      vacuum_extension: string;
    }
  }>({});
  const [savingConfigType, setSavingConfigType] = useState<string | null>(null);
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      const [servicesData, configsData] = await Promise.all([
        getServices(),
        getVehicleTypeConfigs()
      ]);

      setServices(servicesData);
      setVehicleConfigs(configsData);
      
      // Initialize prices inputs
      const priceState: { [id: number]: string } = {};
      servicesData.forEach((s) => {
        priceState[s.id] = s.price.toFixed(2);
      });
      setPrices(priceState);

      // Initialize config inputs
      const durationState: typeof configsState = {};
      configsData.forEach((c) => {
        durationState[c.vehicle_type] = {
          karcher_initial: String(c.karcher_initial_seconds),
          karcher_extension: String(c.karcher_extension_seconds),
          vacuum_initial: c.vacuum_initial_seconds !== null ? String(c.vacuum_initial_seconds) : '',
          vacuum_extension: c.vacuum_extension_seconds !== null ? String(c.vacuum_extension_seconds) : '',
        };
      });
      setConfigsState(durationState);

    } catch (err) {
      console.error('Failed to load settings data:', err);
      setErrorMsg('Impossible de charger les données de configuration. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  useEffect(() => {
    loadData();
  }, []);

  // --- Service Actions ---
  const handlePriceChange = (id: number, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrices((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSavePrice = async (id: number, name: string) => {
    const inputVal = prices[id];
    const newPrice = parseFloat(inputVal);

    if (isNaN(newPrice) || newPrice < 0) {
      setErrorMsg(`Veuillez entrer un tarif valide pour "${name}"`);
      return;
    }

    setSavingServiceId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await updateServicePrice(id, newPrice);
      setSuccessMsg(`Le tarif de "${name}" a été mis à jour à ${newPrice.toFixed(2)} DT`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to update service price:', err);
      setErrorMsg(`Échec de la mise à jour du tarif de "${name}".`);
    } finally {
      setSavingServiceId(null);
    }
  };

  // --- Duration Actions ---
  const handleDurationChange = (type: string, field: 'karcher_initial' | 'karcher_extension' | 'vacuum_initial' | 'vacuum_extension', value: string) => {
    if (value === '' || /^\d*$/.test(value)) {
      setConfigsState((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [field]: value
        }
      }));
    }
  };

  const handleSaveDurationConfig = async (type: string) => {
    const vals = configsState[type];
    const karcher_initial = parseInt(vals.karcher_initial, 10);
    const karcher_extension = parseInt(vals.karcher_extension, 10);

    const hasVacuum = type !== 'Moto' && type !== 'Tapis' && type !== 'Tacha';
    const vacuum_initial = hasVacuum ? parseInt(vals.vacuum_initial, 10) : null;
    const vacuum_extension = hasVacuum ? parseInt(vals.vacuum_extension, 10) : null;

    if (isNaN(karcher_initial) || isNaN(karcher_extension) || karcher_initial < 0 || karcher_extension < 0) {
      setErrorMsg(`Veuillez entrer des durées Kärcher valides pour "${type}"`);
      return;
    }

    if (hasVacuum && (isNaN(vacuum_initial!) || isNaN(vacuum_extension!) || vacuum_initial! < 0 || vacuum_extension! < 0)) {
      setErrorMsg(`Veuillez entrer des durées d'aspirateur valides pour "${type}"`);
      return;
    }

    setSavingConfigType(type);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await updateVehicleTypeConfig(type, {
        karcher_initial_seconds: karcher_initial,
        karcher_extension_seconds: karcher_extension,
        vacuum_initial_seconds: vacuum_initial,
        vacuum_extension_seconds: vacuum_extension
      });
      setSuccessMsg(`Les paramètres de durée pour "${type}" ont été enregistrés.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to update config:', err);
      setErrorMsg(`Échec de la mise à jour des durées de "${type}".`);
    } finally {
      setSavingConfigType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px] text-gray-800">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-semibold text-sm">Chargement des données de configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 text-gray-800">
      
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Configuration de la station</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Modifier les grilles de tarifs et les durées d&apos;activation des postes.</p>
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

      {/* Grid container to organize columns responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 1: PRICES (Left side) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="border-b border-gray-150 pb-3 flex items-center space-x-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Grille des Tarifs</h3>
            </div>

            <div className="space-y-3.5">
              {services.map((service) => {
                const isSaving = savingServiceId === service.id;
                return (
                  <div key={service.id} className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-gray-900 text-xs">{service.name}</span>
                      <span className="text-[8px] bg-gray-200 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">
                        #{service.id}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 justify-between">
                      <div className="relative rounded-lg shadow-sm w-28">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                          <span className="text-gray-400 text-[10px] font-bold">DT</span>
                        </div>
                        <input
                          type="text"
                          value={prices[service.id] || ''}
                          onChange={(e) => handlePriceChange(service.id, e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 bg-white py-1 pl-7 pr-2 text-xs font-black text-blue-600 focus:outline-none text-right"
                          disabled={isSaving}
                        />
                      </div>
                      <button
                        onClick={() => handleSavePrice(service.id, service.name)}
                        disabled={isSaving}
                        className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>Enregistrer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: TIMERS (Right side) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="border-b border-gray-150 pb-3 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Minuteurs Matériels (Durées en secondes)</h3>
            </div>

            <div className="space-y-4">
              {vehicleConfigs.map((config) => {
                const type = config.vehicle_type;
                const vals = configsState[type] || { karcher_initial: '', karcher_extension: '', vacuum_initial: '', vacuum_extension: '' };
                const isSaving = savingConfigType === type;
                const hasVacuum = type !== 'Moto' && type !== 'Tapis' && type !== 'Tacha';

                return (
                  <div key={type} className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                      <span className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wider">{type}</span>
                      <button
                        onClick={() => handleSaveDurationConfig(type)}
                        disabled={isSaving}
                        className="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-[10px] sm:text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>Enregistrer</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Karcher card */}
                      <div className="bg-white border border-gray-200 p-2.5 rounded-xl space-y-2">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Kärcher (Partagé)</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] font-bold text-gray-400 uppercase">Initial (sec)</label>
                            <input
                              type="text"
                              value={vals.karcher_initial}
                              onChange={(e) => handleDurationChange(type, 'karcher_initial', e.target.value)}
                              className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center font-bold text-gray-800"
                              disabled={isSaving}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-gray-400 uppercase">Extension (sec)</label>
                            <input
                              type="text"
                              value={vals.karcher_extension}
                              onChange={(e) => handleDurationChange(type, 'karcher_extension', e.target.value)}
                              className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center font-bold text-gray-800"
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Vacuum card */}
                      <div className={`p-2.5 rounded-xl space-y-2 ${hasVacuum ? 'bg-white border border-gray-200' : 'bg-gray-100 border border-dashed border-gray-250 opacity-60'}`}>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Aspirateur</p>
                        {hasVacuum ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[8px] font-bold text-gray-400 uppercase">Initial (sec)</label>
                              <input
                                type="text"
                                value={vals.vacuum_initial}
                                onChange={(e) => handleDurationChange(type, 'vacuum_initial', e.target.value)}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center font-bold text-gray-800"
                                disabled={isSaving}
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-gray-400 uppercase">Extension (sec)</label>
                              <input
                                type="text"
                                value={vals.vacuum_extension}
                                onChange={(e) => handleDurationChange(type, 'vacuum_extension', e.target.value)}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center font-bold text-gray-800"
                                disabled={isSaving}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="h-9 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-gray-450 italic">Non disponible</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
