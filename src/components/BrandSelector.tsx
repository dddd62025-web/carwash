'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface BrandSelectorProps {
  onSelectBrand: (brand: string) => void;
}

const BRANDS = [
  { name: 'Audi', logo: 'audi-logo.png' },
  { name: 'BMW', logo: 'bmw-logo.png' },
  { name: 'Citroën', logo: 'citroen-logo.png' },
  { name: 'Dacia', logo: 'dacia-logo.png' },
  { name: 'Fiat', logo: 'fiat-logo.png' },
  { name: 'Ford', logo: 'ford-logo.png' },
  { name: 'Hyundai', logo: 'hyundai-logo.png' },
  { name: 'Isuzu', logo: 'isuzu-logo.png' },
  { name: 'Kia', logo: 'kia-logo.png' },
  { name: 'Mazda', logo: 'mazda-logo.png' },
  { name: 'Mercedes', logo: 'mercedes-benz-logo.png' },
  { name: 'Nissan', logo: 'nissan-logo.png' },
  { name: 'Peugeot', logo: 'peugeot-logo.png' },
  { name: 'Renault', logo: 'renault-logo.png' },
  { name: 'Seat', logo: 'seat-logo.png' },
  { name: 'Skoda', logo: 'skoda-logo.png' },
  { name: 'Suzuki', logo: 'suzuki-logo.png' },
  { name: 'Toyota', logo: 'toyota-logo.png' },
  { name: 'Volkswagen', logo: 'volkswagen-logo.png' },
  { name: 'Autre', logo: null }
];

export default function BrandSelector({ onSelectBrand }: BrandSelectorProps) {
  // Track image load errors to display fallback placeholders
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});

  const handleImageError = (brandName: string) => {
    setImageErrors((prev) => ({
      ...prev,
      [brandName]: true
    }));
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6 text-gray-800">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Sélectionner la marque
        </h1>
        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">
          Marques du marché tunisien
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
        {BRANDS.map((brand) => {
          const hasError = !brand.logo || imageErrors[brand.name];

          return (
            <button
              key={brand.name}
              onClick={() => onSelectBrand(brand.name)}
              className="flex flex-col items-center justify-center p-4 h-28 sm:h-32 bg-white border border-gray-200 hover:border-blue-500 hover:shadow-lg rounded-2xl transition-all duration-205 active:scale-[0.97] group"
            >
              {/* Logo Area */}
              <div className="w-11 h-11 sm:w-14 sm:h-14 flex items-center justify-center mb-1.5 sm:mb-2">
                {hasError ? (
                  brand.name === 'Autre' ? (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-150 rounded-xl flex items-center justify-center text-gray-400 shadow-sm border border-gray-200">
                      <HelpCircle className="w-5.5 h-5.5" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl flex items-center justify-center font-extrabold text-gray-400 text-[10px] sm:text-xs shadow-sm border border-gray-200 select-none">
                      {brand.name.slice(0, 2).toUpperCase()}
                    </div>
                  )
                ) : (
                  <img
                    src={`https://vl.imgix.net/img/${brand.logo}?w=120&h=120&fit=clip`}
                    alt={`${brand.name} logo`}
                    onError={() => handleImageError(brand.name)}
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                )}
              </div>

              {/* Label */}
              <span className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate w-full text-center">
                {brand.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
