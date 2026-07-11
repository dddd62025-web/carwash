'use client';

import React, { useState, useEffect } from 'react';
import { getServices, createJob, Service } from '@/lib/db';
import { Loader2, Check, ArrowLeft, ClipboardList, CheckSquare, X } from 'lucide-react';

interface ServiceChecklistProps {
  selectedBrand: string;
  employeeId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function ServiceChecklist({
  selectedBrand,
  employeeId,
  onCancel,
  onSuccess,
}: ServiceChecklistProps) {
  // States
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Services on Mount
  useEffect(() => {
    async function fetchServicesList() {
      try {
        setLoading(true);
        const data = await getServices();
        setServices(data);
      } catch (err) {
        console.error('Error fetching services:', err);
        setErrorMessage('Échec du chargement des prestations. Veuillez vérifier votre connexion.');
      } finally {
        setLoading(false);
      }
    }
    fetchServicesList();
  }, []);

  // Toggle service selection
  const toggleService = (id: number) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((serviceId) => serviceId !== id) : [...prev, id]
    );
  };

  // Get details of selected services
  const getSelectedServicesDetails = () => {
    return services.filter((s) => selectedServices.includes(s.id));
  };

  // Calculate total price
  const calculateTotal = () => {
    return getSelectedServicesDetails().reduce((sum, s) => sum + s.price, 0);
  };

  // Submit and save job
  const handleConfirmSave = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const totalAmount = calculateTotal();
      const selectedServicesArray = getSelectedServicesDetails().map((s) => ({
        serviceId: s.id,
        priceCharged: s.price,
      }));

      await createJob(employeeId, selectedBrand, totalAmount, selectedServicesArray);

      setSuccessMessage('Lavage enregistré avec succès !');
      setTimeout(() => {
        setSuccessMessage(null);
        setIsModalOpen(false);
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving job:', err);
      setErrorMessage(err?.message || 'Échec de l\'enregistrement des détails du lavage. Veuillez réessayer.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px] text-gray-800">
        <Loader2 className="w-10 h-10 text-blue-650 animate-spin mb-4" />
        <p className="text-gray-500 font-semibold text-sm">Chargement des prestations...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col bg-gray-50 min-h-screen pb-40 text-gray-800 px-3 sm:px-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 rounded-b-3xl flex items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
        <button
          onClick={onCancel}
          className="flex items-center space-x-1.5 text-blue-600 hover:text-blue-800 font-bold py-2 px-3 sm:px-4 rounded-xl bg-blue-50 active:scale-95 transition-all text-sm sm:text-base shrink-0"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
          <span>Retour</span>
        </button>

        <div className="text-center flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-black text-gray-900 truncate">Sélectionner les prestations</h1>
          <p className="text-xs font-semibold text-gray-400 mt-0.5 truncate">
            Véhicule : <span className="text-blue-600 font-extrabold uppercase">{selectedBrand}</span>
          </p>
        </div>

        {/* Small spacer to align header on wider screens */}
        <div className="w-16 sm:w-20 shrink-0 hidden sm:block"></div>
      </header>

      {/* Main Content (Grid layout of services) */}
      <main className="py-6 flex-1">
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm font-semibold">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {services.map((service) => {
            const isSelected = selectedServices.includes(service.id);
            return (
              <button
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`p-5 sm:p-6 rounded-2xl text-left flex items-start justify-between min-h-[110px] transition-all duration-200 active:scale-[0.98] ${
                  isSelected
                    ? 'border-2 border-blue-600 bg-blue-50/70 shadow-md shadow-blue-100'
                    : 'border border-gray-200 bg-white hover:bg-gray-50/80 shadow-sm hover:border-gray-300'
                }`}
              >
                <div className="flex-1 pr-3 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight leading-snug truncate">
                    {service.name}
                  </h3>
                  <p className="text-lg sm:text-xl font-black text-blue-600 mt-2">
                    {service.price.toFixed(2)} <span className="text-xs font-bold text-blue-500">DT</span>
                  </p>
                </div>

                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Floating Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl py-4 sm:py-5 px-4 sm:px-6 z-20">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="text-center sm:text-left flex sm:flex-col justify-between items-center sm:items-start w-full sm:w-auto">
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Montant Total</p>
            <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-0.5">
              {calculateTotal().toFixed(2)} <span className="text-base sm:text-lg font-bold">DT</span>
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            disabled={selectedServices.length === 0}
            className="w-full sm:w-auto min-w-[200px] sm:min-w-[240px] py-3.5 sm:py-4 px-6 sm:px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-250 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-extrabold text-base sm:text-lg rounded-2xl transition-all shadow-lg shadow-blue-600/15 active:scale-95 flex items-center justify-center space-x-2"
          >
            <ClipboardList className="w-4.5 h-4.5" />
            <span>Confirmer & Enregistrer</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <span>Confirmation du lavage</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="p-1 rounded-lg hover:bg-gray-200 text-gray-450 hover:text-gray-650"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {successMessage ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-3">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <p className="text-base sm:text-lg font-bold text-gray-900">{successMessage}</p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Marque de voiture</p>
                      <p className="text-base sm:text-lg font-extrabold text-blue-900 uppercase mt-0.5">{selectedBrand}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 py-1 px-3 rounded-full uppercase">
                      Tunisie POS
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prestations Sélectionnées</p>
                    <div className="divide-y divide-gray-100 max-h-36 overflow-y-auto pr-1">
                      {getSelectedServicesDetails().map((s) => (
                        <div key={s.id} className="flex justify-between items-center py-2 text-xs sm:text-sm">
                          <span className="font-semibold text-gray-600">{s.name}</span>
                          <span className="font-bold text-gray-900">{s.price.toFixed(2)} DT</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3.5 border-t border-gray-100">
                    <span className="text-sm font-bold text-gray-400">Total à payer</span>
                    <span className="text-xl sm:text-2xl font-black text-blue-600">
                      {calculateTotal().toFixed(2)} DT
                    </span>
                  </div>
                </>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            {!successMessage && (
              <div className="bg-gray-50 px-5 py-4 border-t border-gray-100 flex space-x-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 py-3 bg-white border border-gray-250 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50 active:scale-95"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 shadow-md shadow-blue-200 active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Valider & Sauvegarder</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
