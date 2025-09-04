// src/taskpane/components/shared/SelectedAktIndicator.tsx
import React from 'react';
import Button from 'devextreme-react/button';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setSelectedAkt } from '../../../store/slices/aktenSlice';

const SelectedAktIndicator: React.FC = () => {
  const dispatch = useAppDispatch();
  const { selectedAkt } = useAppSelector(state => state.akten);

  if (!selectedAkt) {
    return null;
  }

  return (
    <div style={{ 
      backgroundColor: '#f8f9fa', 
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="dx-icon dx-icon-check" style={{ color: '#0078d4', fontSize: '16px' }} />
        <div>
          <strong style={{ color: '#212529' }}>Selected Case:</strong>
          <span style={{ marginLeft: '8px', fontWeight: '500', color: '#495057' }}>
            {selectedAkt.aKurz}
          </span>
          {selectedAkt.causa && (
            <span style={{ marginLeft: '8px', color: '#6c757d', fontSize: '14px' }}>
              - {selectedAkt.causa}
            </span>
          )}
        </div>
      </div>
      <Button
        icon="close"
        stylingMode="text"
        hint="Clear selection"
        onClick={() => dispatch(setSelectedAkt(null))}
        elementAttr={{ style: { minWidth: 'auto', padding: '4px' } }}
      />
    </div>
  );
};

export default SelectedAktIndicator;
