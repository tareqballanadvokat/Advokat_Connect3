import React from 'react';

export interface CustomTitleProps {
  personId: number;
  anzeigename: string;
  isDeleting?: boolean;
  onDelete: () => void;
}

export default function CustomTitle({ anzeigename, isDeleting = false, onDelete }: Omit<CustomTitleProps, 'personId'>) {
  return (
    <div
      className='person-title-row'
      style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4, paddingRight: 6 }}
    >
      {/* Section 1 – name (takes remaining space, truncates) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {isDeleting ? (
          <i
            className="dx-icon dx-icon-refresh"
            style={{ fontSize: 16, color: '#a0aec0', animation: 'spin 1s linear infinite', flexShrink: 0 }}
          />
        ) : (
          <i className="dx-icon dx-icon-user" style={{ fontSize: 16, flexShrink: 0 }} />
        )}
        <span style={{
          opacity: isDeleting ? 0.7 : 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {anzeigename}
          {isDeleting && ' (Removing...)'}
        </span>
      </div>

      {/* Section 2 – delete icon (fixed width, always reserves space) */}
      <div style={{ flexShrink: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          className={`dx-button dx-button-normal dx-button-mode-contained delete-favorite-btn${isDeleting ? ' loading-button' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeleting) onDelete();
          }}
          disabled={isDeleting}
          title={isDeleting ? 'Removing from favorites...' : 'Remove from favorites'}
          style={{
            backgroundColor: isDeleting ? '#f5f5f5' : '#d32f2f',
            color: isDeleting ? '#666' : 'white',
            border: 'none',
            borderRadius: '3px',
            padding: '4px 8px',
            cursor: isDeleting ? 'not-allowed' : 'pointer'
          }}
        >
          <i className={`dx-icon dx-icon-${isDeleting ? 'refresh' : 'trash'}`} />
        </button>
      </div>

      {/* Section 3 – reserved space for DevExtreme expansion arrow */}
      <div style={{ flexShrink: 0, width: 20 }} />
    </div>
  );
}