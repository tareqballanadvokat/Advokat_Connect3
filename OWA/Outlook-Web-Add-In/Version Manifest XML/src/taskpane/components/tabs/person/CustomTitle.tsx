import React from 'react';
 
export interface CustomTitleProps {
  personId: number;
  anzeigename: string;
  onDelete: () => void;
}

export default function CustomTitle({ anzeigename, onDelete }: Omit<CustomTitleProps, 'personId'>) {
  return (
    <div className='header' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="dx-icon dx-icon-user" style={{ fontSize: 16 }} />
        <span>{anzeigename}</span>
      </div>
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
    </div>
  );
}