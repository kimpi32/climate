'use client';

import { CITIES } from '@/lib/constants';

interface CitySelectorProps {
  selectedCity: string;
  onCityChange: (cityId: string) => void;
}

export default function CitySelector({ selectedCity, onCityChange }: CitySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CITIES.map((city) => (
        <button
          key={city.id}
          onClick={() => onCityChange(city.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
            selectedCity === city.id
              ? 'bg-[var(--accent)] text-white shadow-lg shadow-red-500/20'
              : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]'
          }`}
        >
          {city.name}
        </button>
      ))}
    </div>
  );
}
