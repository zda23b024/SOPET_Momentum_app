import React from 'react';
import logo from '../../assets/sopet-logo.png';

export const officialLogo = logo;

// Frame the supplied artwork tightly without changing or stretching the source.
export const BrandLogo: React.FC<{ className?: string }> = ({ className = 'h-12' }) => (
  <span className={`relative inline-block align-middle overflow-hidden shrink-0 ${className}`} style={{ aspectRatio: '2.55 / 1' }}>
    <img src={officialLogo} alt="SOPET Momentum" className="absolute max-w-none mix-blend-multiply" style={{ width: '106%', height: 'auto', left: '-3%', top: '-20%' }} />
  </span>
);
