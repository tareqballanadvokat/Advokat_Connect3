// src/taskpane/components/tabs/email/EmailSend.tsx
import React from 'react';
import { EmailSendProps } from '../../interfaces/IEmail';
import Button from 'devextreme-react/button';

// Inject CSS for orange loading button
const orangeButtonStyles = `
  .transfer-button-loading .dx-button-content {
    background-color: #ff8c00 !important;
    color: #fff !important;
    border-color: #ff8c00 !important;
  }
  .transfer-button-loading:not(.dx-state-disabled) {
    background-color: #ff8c00 !important;
    border-color: #ff8c00 !important;
  }
`;

// Add styles to document head if not already added
if (!document.getElementById('transfer-button-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.id = 'transfer-button-styles';
  styleSheet.innerText = orangeButtonStyles;
  document.head.appendChild(styleSheet);
}

const EmailSend: React.FC<EmailSendProps> = ({ 
    caseId,
    onTransfer,
    transferBtnDisable,
    transferLoading = false
}) => (
  <div>  
    <h3>Case</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 24px' }}>

    <input
      type="text"
      placeholder="Case ID"
      value={caseId}
      width={80}
      readOnly
      style={{ 
        width:150,
        padding: '8px 12px',
        fontSize: 14,
        border: '1px solid #ccc',
        borderRadius: 4,
        backgroundColor: '#f5f5f5',
        cursor: 'default'
      }}
    />
    <Button
        text={transferLoading ? "Sending..." : "Transfer"}
        type={transferLoading ? "default" : "success"}
        width={transferLoading ? 100 : 80}
        disabled={transferBtnDisable || transferLoading}
        className={transferLoading ? "transfer-button-loading" : ""}
        style={{
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 4
        }}
        stylingMode="contained" onClick={() => {
        onTransfer();
      }}
    />
  </div></div>
);

export default EmailSend;
