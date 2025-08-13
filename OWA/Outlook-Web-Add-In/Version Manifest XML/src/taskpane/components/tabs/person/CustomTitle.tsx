import React from 'react';
 
export interface CustomTitleProps {
  id: string;
  fullName: string;
  onDelete: () => void;
}

export default function CustomTitle({ id, fullName, onDelete }: CustomTitleProps) {
  return (
    <div className='header' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{fullName} {id}</span>
      <button
        onClick={onDelete}
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