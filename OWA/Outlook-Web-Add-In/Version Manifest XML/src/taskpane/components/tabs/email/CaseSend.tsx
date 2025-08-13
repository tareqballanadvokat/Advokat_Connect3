// src/taskpane/components/tabs/email/CaseSend.tsx
import React from 'react';
import Button from 'devextreme-react/button';
import { CaseSendProps } from '../../interfaces/IEmail';


const CaseSend: React.FC<CaseSendProps> = ({ caseId, onCaseChange, onTransfer }) => (
  <div><h3>Case</h3>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 24px' }}>
    
    <input
      type="text"
      placeholder="Case ID"
      value={caseId}
      onChange={e => onCaseChange(e.target.value)}
      style={{
        flex: 1,
        padding: '8px 12px',
        fontSize: 14,
        border: '1px solid #ccc',
        borderRadius: 4
      }}
    />
    <Button
      text="Transfer"
      type="success"
      stylingMode="contained"
      onClick={onTransfer}
    />
  </div></div>
);

export default CaseSend;
