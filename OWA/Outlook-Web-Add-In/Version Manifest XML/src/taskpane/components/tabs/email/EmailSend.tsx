// src/taskpane/components/tabs/email/CaseSend.tsx
import React from 'react';
import Button from 'devextreme-react/button';
import { Height } from 'devextreme-react/cjs/chart';

interface EmailSendProps {
  caseId: string;
  onCaseChange: (id: string) => void;
  onTransfer: () => void;
  sb:string;
  abbreviation:string;
  text: string;
  time: string;
}

const EmailSend: React.FC<EmailSendProps> = ({ 
    caseId,
    onCaseChange,
    onTransfer,
    sb,
    abbreviation,
    text,
    time
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 24px' }}>
  
    <input
      type="text"
      placeholder="Case ID"
      value={caseId}
      width={80}
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
        style={{
          width: 80,
          Height: 80,
          padding: '8px 12px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
        stylingMode="contained" onClick={() => {
        // masz tu dostęp do wszystkich pól:
            console.log({
            caseId,
            service: {
                abbreviation,
                sb,
                time,
                text
            }
            });
        onTransfer();
      }}
    />
  </div>
);

export default EmailSend;
