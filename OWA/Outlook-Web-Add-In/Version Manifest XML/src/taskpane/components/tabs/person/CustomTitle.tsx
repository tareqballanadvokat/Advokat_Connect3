import React from 'react';
 
export interface CustomTitleProps {
  personId: number;
  anzeigename: string;
  isDeleting?: boolean;
  onDelete: () => void;
}

export default function CustomTitle({ anzeigename, isDeleting = false, onDelete }: Omit<CustomTitleProps, 'personId'>) {
  return (
    <div className='header' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isDeleting ? (
          <i
            className="dx-icon dx-icon-refresh"
            style={{
              fontSize: 16,
              color: '#a0aec0',
              animation: 'spin 1s linear infinite'
            }}
          />
        ) : (
          <i className="dx-icon dx-icon-user" style={{ fontSize: 16 }} />
        )}
        <span style={{ opacity: isDeleting ? 0.7 : 1 }}>
          {anzeigename}
          {isDeleting && ' (Removing...)'}
        </span>
      </div>
      {!isDeleting && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent accordion expansion
            onDelete();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#a0aec0',
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}