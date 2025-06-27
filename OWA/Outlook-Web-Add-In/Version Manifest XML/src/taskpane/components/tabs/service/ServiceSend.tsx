// src/taskpane/components/tabs/email/CaseSend.tsx
import React from 'react';
import Button from 'devextreme-react/button';
import { Height } from 'devextreme-react/cjs/chart';

interface ServiceSendProps {
  caseId: string;
  onCaseChange: (id: string) => void;
  onTransfer: () => void;
  caseIdDisable: boolean;
  transferBtnDisable:boolean;
}

const ServiceSend: React.FC<ServiceSendProps> = ({ 
    caseId,
    onCaseChange,
    onTransfer,
    caseIdDisable,
    transferBtnDisable
}) => ( <div>  <h3>Case</h3>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 24px' }}>
   
    <input
      type="text"
      placeholder="Case ID"
      value={caseId}
      width={80}
      disabled={caseIdDisable}
      onChange={e => onCaseChange(e.target.value)}
      style={{ 
        width:150,
        padding: '8px 12px',
        fontSize: 14,
        border: '1px solid #ccc',
        borderRadius: 4
      }}
    />
    <Button
        text="Transfer"
        type="success"
        width={80}
        disabled={transferBtnDisable}
        style={{
          // width: 80,
          // Height: 80,
          // padding: '8px 12px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
        stylingMode="contained" onClick={() => {
        onTransfer();
      }}
    />
  </div>  </div>
);

export default ServiceSend;
