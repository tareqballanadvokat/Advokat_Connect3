// src/taskpane/components/tabs/shared/PairingDialog.tsx
import React, { useState } from 'react';
import { useAppSelector } from '@store/hooks';
import { selectPairingStatus } from '@slices/pairingSlice';
import { selectOfficeToken } from '@slices/authSlice';
import { pairingApiService } from '@services/PairingApiService';
import { useTranslation } from 'react-i18next';

/**
 * PairingDialog
 *
 * Shown when pairingStatus === 'unpaired' (first-time setup).
 * User enters the OTP from the ADVOKAT Desktop Client.
 * On submit: POST /addin/pair → { advokatServerId } → pairingSlice updated → dialog disappears.
 */
const PairingDialog: React.FC = () => {
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pairingStatus = useAppSelector(selectPairingStatus);
  const officeToken = useAppSelector(selectOfficeToken);
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
    backgroundColor: isSubmitting || !otp.trim() ? '#c8c6c4' : '#0078d4',
    color: '#ffffff',
    border: 'none',
    borderRadius: '2px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: isSubmitting || !otp.trim() ? 'not-allowed' : 'pointer',
  };

  const errorStyle: React.CSSProperties = {
    marginTop: '8px',
    padding: '6px 8px',
    backgroundColor: '#fde7e9',
    border: '1px solid #d13438',
    borderRadius: '2px',
    fontSize: '11px',
    color: '#a4262c',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || isSubmitting) return;

    if (!officeToken) {
      setSubmitError('Office SSO token is not available. Please reload the add-in and try again.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await pairingApiService.pair(trimmedOtp, officeToken);
      // pairingApiService dispatches setPaired → pairingStatus becomes 'paired' → this component unmounts
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Pairing failed. Please check the code and try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
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
          placeholder="ABCD123456"
          value={otp}
          onChange={(e) => { setOtp(e.target.value.toUpperCase()); setSubmitError(null); }}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          disabled={isSubmitting}
          aria-label={translate('pairing.otpLabel', 'One-time pairing code')}
        />
        <button type="submit" style={buttonStyle} disabled={isSubmitting || !otp.trim()}>
          {isSubmitting
            ? translate('pairing.submitting', 'Pairing…')
            : translate('pairing.submitButton', 'Pair with ADVOKAT')}
        </button>
      </form>
      {submitError && (
        <div style={errorStyle}>
          ❌ {submitError}
        </div>
      )}
    </div>
  );
};

export default PairingDialog;
