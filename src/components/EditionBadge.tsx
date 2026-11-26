import React from 'react';
import { WRISTBAND_EDITIONS } from '../data/mallConfig';
import { EditionId } from '../types/safestep';

interface EditionBadgeProps {
  editionId: EditionId;
  size?: 'sm' | 'md' | 'lg';
}

export const EditionBadge: React.FC<EditionBadgeProps> = ({ editionId, size = 'md' }) => {
  const meta = WRISTBAND_EDITIONS[editionId];

  const boxSize =
    size === 'sm' ? 'w-8 h-8 rounded-lg' : size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-xl';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  return (
    <div
      className={`${boxSize} flex items-center justify-center shrink-0 backdrop-blur-md`}
      style={{
        backgroundColor: meta.tintBg,
        border: `1px solid ${meta.borderColor}`,
        color: meta.textColor,
      }}
      aria-label={meta.name}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {editionId === 'batman' && (
          <>
            {/* Architectural Angular Wing Emblem */}
            <path d="M2.5 11.5L7 7.5L9.5 10.5L12 7L14.5 10.5L17 7.5L21.5 11.5L17.5 14L15 13L12 17.5L9 13L6.5 14L2.5 11.5Z" />
          </>
        )}
        {editionId === 'spiderman' && (
          <>
            {/* Geometric Radial Web Octagon */}
            <polygon points="12 2.5 18.7 5.3 21.5 12 18.7 18.7 12 21.5 5.3 18.7 2.5 12 5.3 5.3" />
            <polygon points="12 7 15.5 8.5 17 12 15.5 15.5 12 17 8.5 15.5 7 12 8.5 8.5" />
            <line x1="12" y1="2.5" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="21.5" y2="12" />
            <line x1="5.3" y1="5.3" x2="18.7" y2="18.7" />
            <line x1="18.7" y1="5.3" x2="5.3" y2="18.7" />
          </>
        )}
        {editionId === 'space' && (
          <>
            {/* Precision Orbital Ring & Compass Star */}
            <circle cx="12" cy="12" r="4" />
            <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)" />
            <circle cx="18.8" cy="7.4" r="1.4" fill="currentColor" stroke="none" />
          </>
        )}
        {editionId === 'ice' && (
          <>
            {/* Crystalline Hexagonal Snowflake */}
            <line x1="12" y1="2.5" x2="12" y2="21.5" />
            <line x1="3.8" y1="7.2" x2="20.2" y2="16.8" />
            <line x1="20.2" y1="7.2" x2="3.8" y2="16.8" />
            <polygon points="12 7.5 15.9 9.75 15.9 14.25 12 16.5 8.1 14.25 8.1 9.75" />
          </>
        )}
      </svg>
    </div>
  );
};
