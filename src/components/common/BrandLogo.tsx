import React from 'react';
// Vite resolves the official asset when supplied. Never substitute a generated logo.
const assets = import.meta.glob('/src/assets/sopet-logo.png', { eager: true, query: '?url', import: 'default' });
export const officialLogo = assets['/src/assets/sopet-logo.png'] as string | undefined;
export const BrandLogo: React.FC<{ className?: string }> = ({ className = 'h-10 w-auto' }) =>
  officialLogo ? <img src={officialLogo} alt="SOPET — The Soft Persona Tool" className={`object-contain max-w-full shrink-0 ${className}`} style={{ aspectRatio: '1 / 1', borderRadius: '50%', backgroundColor: 'white' }} /> :
  <span className="inline-flex shrink-0 items-center h-12 w-12 justify-center rounded-full border border-current/20 text-sm font-bold tracking-wide" aria-label="SOPET — The Soft Persona Tool">SOPET</span>;
