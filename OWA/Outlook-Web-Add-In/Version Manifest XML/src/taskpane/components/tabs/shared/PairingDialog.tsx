// src/taskpane/components/tabs/shared/PairingDialog.tsx
import React, { useState } from 'react';
import { useAppSelector } from '@store/hooks';
import { selectPairingStatus } from '@slices/pairingSlice';
import { useTranslation } from 'react-i18next';

/**
 * PairingDialog
 *
 * Shown when pairingStatus === 'unpaired' (first-time setup).
 * Instructs the user to open the ADVOKAT Desktop Client, generate an OTP,
 * and paste it here.
 *
 * ⚠️  STUB — OTP submission is disabled until the ADVOKAT Server implements
 *     the REGISTER_OTP handler. The input and button are rendered but the
 *     submit action is a no-op placeholder.
 *
 * When ready:
 *   1. Import `webRTCApiService` and `pairingApiService`
 *   2. Call `webRTCApiService.sendRegisterOtpMessage(otp, officeToken)` on submit
 *   3. Dispatch `setAdvokatToken(result.advokatToken)` to Redux
 *   4. Re-run `pairingApiService.checkServerId(officeToken)` to confirm pairing
 */
const PairingDialog: React.FC = () => {
  const [otp, setOtp] = useState('');
  const pairingStatus = useAppSelector(selectPairingStatus);
  const { t: translate } = useTranslation('common');

  if (pairingStatus !== 'unpaired') {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    padding: '16px',
    border: '1px solid #0078d4',
    borderRadius: '4px',
    backgroundColor: '#f0f6ff',
    margin: '8px 0',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#0078d4',
    marginBottom: '8px',
  };

  const instructionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#323130',
    marginBottom: '12px',
    lineHeight: '1.5',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: '14px',
    letterSpacing: '2px',
    fontFamily: 'monospace',
    border: '1px solid #8a8886',
    borderRadius: '2px',
    boxSizing: 'border-box',
    marginBottom: '8px',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    backgroundColor: '#0078d4',
    color: '#ffffff',
    border: 'none',
    borderRadius: '2px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'not-allowed',
    opacity: 0.6,
  };

  const stubBannerStyle: React.CSSProperties = {
    marginTop: '8px',
    padding: '6px 8px',
    backgroundColor: '#fff4ce',
    border: '1px solid #f7d560',
    borderRadius: '2px',
    fontSize: '11px',
    color: '#7d5c00',
  };

  // TODO: Replace with real submit handler once ADVOKAT Server supports REGISTER_OTP
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder — ADVOKAT Server REGISTER_OTP handler not yet implemented
  };

  return (
    <div style={containerStyle}>
      <div style={headingStyle}>
        {translate('pairing.title', 'ADVOKAT Server Pairing Required')}
      </div>
      <div style={instructionStyle}>
        {translate(
          'pairing.instruction',
          'Open the ADVOKAT Desktop Client, go to Tools → Outlook Add-in Registration, and paste the code shown here.'
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          style={inputStyle}
          placeholder="X7K2-M9P4"
          value={otp}
          onChange={(e) => setOtp(e.target.value.toUpperCase())}
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
          aria-label={translate('pairing.otpLabel', 'One-time pairing code')}
        />
        <button type="submit" style={buttonStyle} disabled>
          {translate('pairing.submitButton', 'Pair with ADVOKAT')}
        </button>
      </form>
      <div style={stubBannerStyle}>
        ⏳ {translate(
          'pairing.stubNotice',
          'Waiting for ADVOKAT Server OTP handler — submission will be enabled once available.'
        )}
      </div>
    </div>
  );
};

export default PairingDialog;
