// src/taskpane/components/tabs/service/ServiceSend.tsx
import React from 'react';
import Button from 'devextreme-react/button';
import { useTranslation } from 'react-i18next';
import './ServiceSend.css';
import '../shared/shared.css';

interface ServiceSendProps {
  caseId: string;
  onTransfer: () => void;
  transferBtnDisable: boolean;
  transferLoading?: boolean;  // New prop for loading state
}

const ServiceSend: React.FC<ServiceSendProps> = ({ 
    caseId,
    onTransfer,
    transferBtnDisable,
    transferLoading = false
}) => {
  const { t: translate } = useTranslation('common');
  return (
  <div>  <h3>{translate('caseLabel')}</h3>
  <div className="service-send-row">
   
    <input
      type="text"
      placeholder={translate('caseIdPlaceholder')}
      value={caseId}
      readOnly
      className="service-send-case-input"
    />
    <Button
        text={transferLoading ? translate('buttons.sending') : translate('buttons.transfer')}
        type={transferLoading ? "default" : "success"}
        width={transferLoading ? 100 : 80}
        disabled={transferBtnDisable || transferLoading}
        className={`service-send-transfer-btn${transferLoading ? ' transfer-button-loading' : ''}`}
        stylingMode="contained" onClick={() => {
        onTransfer();
      }}
    />
  </div>  </div>
  );
};

export default ServiceSend;
