// src/taskpane/components/tabs/email/EmailSend.tsx
import React from 'react';
import { EmailSendProps } from '@interfaces/IEmail';
import Button from 'devextreme-react/button';
import { useTranslation } from 'react-i18next';
import './EmailSend.css';
import '../shared/shared.css';

const EmailSend: React.FC<EmailSendProps> = ({ 
    caseId,
    onTransfer,
    transferBtnDisable,
    transferLoading = false
}) => {
  const { t: translate } = useTranslation('common');
  return (
  <div>  
    <h3>{translate('caseLabel')}</h3>
    <div className="email-send-row">

    <input
      type="text"
      placeholder={translate('caseIdPlaceholder')}
      value={caseId}
      readOnly
      className="email-send-case-input"
    />
    <Button
        text={transferLoading ? translate('buttons.sending') : translate('buttons.transfer')}
        type={transferLoading ? "default" : "success"}
        width={transferLoading ? 100 : 110}
        disabled={transferBtnDisable || transferLoading}
        className={`email-send-transfer-btn${transferLoading ? ' transfer-button-loading' : ''}`}
        stylingMode="contained" onClick={() => {
        onTransfer();
      }}
    />
  </div></div>
  );
};

export default EmailSend;
