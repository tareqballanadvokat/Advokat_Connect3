// src/taskpane/components/tabs/shared/WebRTCConnectionStatus.tsx
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { selectConnectionState, selectIsReady, selectIsConnected, selectIsConnecting, updateConnectionState } from '@slices/connectionSlice';
import { selectAuthError, selectEmail, selectOfficeAuthErrorKey, clearError, setOfficeAuthErrorKey } from '@slices/authSlice';
import { selectKuerzel } from '@slices/pairingSlice';
import { getWebRTCConnectionManager } from '@services/WebRTCConnectionManager';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();

interface WebRTCConnectionStatusProps {
  className?: string;
  style?: React.CSSProperties;
}

const WebRTCConnectionStatus: React.FC<WebRTCConnectionStatusProps> = ({ className, style }) => {
  const dispatch = useAppDispatch();
  const connectionState = useAppSelector(selectConnectionState);
  const isReady = useAppSelector(selectIsReady);
  const isConnected = useAppSelector(selectIsConnected);
  const isConnecting = useAppSelector(selectIsConnecting);
  const authError = useAppSelector(selectAuthError);
  const officeAuthErrorKey = useAppSelector(selectOfficeAuthErrorKey);
  const kuerzel = useAppSelector(selectKuerzel);
  const email = useAppSelector(selectEmail);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { t: translate } = useTranslation('common');

  useEffect(() => {
    const suffix = connectionState.reconnectAttempts > 0
      ? ` (${connectionState.reconnectAttempts}/${getWebRTCConnectionManager().getConfig().maxReconnectAttempts})`
      : '';
    logger.debug(`Connection status: ${connectionState.connectionStatus}${suffix}`, 'WebRTCConnectionStatus');
  }, [connectionState.connectionStatus, connectionState.reconnectAttempts]);

  const isFailedPermanently = (): boolean => {
    const s = connectionState.connectionStatus;
    return s.includes('Max reconnection attempts') || s.includes('Reconnection failed after');
  };

  // Covers both failure modes: the SIP/WebRTC transport giving up permanently,
  // and the transport staying up but the ADVOKAT JWT exchange failing (authError
  // set, isReady false). Neither recovers on its own — both need a manual retry.
  const needsManualReconnect = (): boolean => isFailedPermanently() || (!!authError && !isReady);

  const isFailing = (): boolean =>
    !!(connectionState.lastError ||
      connectionState.connectionStatus.includes('Failed') ||
      connectionState.connectionStatus.includes('Error') ||
      connectionState.connectionStatus.includes('failed'));

  const getFriendlyMessage = (): string => {
    if (connectionState.idleDisconnectedAt || (!isConnecting && !isConnected && !isReady && !isFailing()))
      return translate('webrtc.disconnected');
    if (authError && !isReady) {
      // If the failure was specifically an Office SSO error (e.g. personal account,
      // not signed in, consent required), show the precise localized reason instead
      // of the generic "authentication failed" message.
      if (officeAuthErrorKey) return translate(officeAuthErrorKey);
      return translate('webrtc.authenticationFailed');
    }
    if (isReady) return translate('webrtc.connected');
    if (isFailedPermanently()) return translate('webrtc.connectionFailedPermanently');
    if (isFailing()) {
      const max = getWebRTCConnectionManager().getConfig().maxReconnectAttempts;
      const attempt = connectionState.reconnectAttempts;
      return translate('webrtc.connectionFailedReconnecting', { attempt, max });
    }
    return translate('webrtc.connecting');
  };

  const handleReconnect = async (): Promise<void> => {
    if (isReconnecting) return;
    setIsReconnecting(true);

    try {
      // Clear stale failure state so the banner reflects the new attempt immediately.
      // (performAuthentication() re-acquires a fresh Office SSO token itself on every
      // connect() cycle, so no need to do it here too.)
      dispatch(updateConnectionState({ reconnectAttempts: 0, lastError: undefined }));
      dispatch(clearError());
      dispatch(setOfficeAuthErrorKey(null));

      // Bypass the automatic backoff/attempt-cap machinery in reconnect() — tear down
      // and start a fresh connect() cycle right away.
      const manager = getWebRTCConnectionManager();
      await manager.disconnect();
      await manager.initialize();
    } catch (error) {
      logger.error('Manual reconnect failed', 'WebRTCConnectionStatus', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const getStatusStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '8px',
      marginBottom: '10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      color: 'white',
      ...style,
    };
    if (connectionState.idleDisconnectedAt || (!isConnecting && !isConnected && !isReady && !isFailing()))
      return { ...base, backgroundColor: '#6c757d', border: '1px solid #5a6268' };
    if (authError && !isReady)
      return { ...base, backgroundColor: '#dc3545', border: '1px solid #bd2130' };
    if (isReady)
      return { ...base, backgroundColor: '#28a745', border: '1px solid #1e7e34' };
    if (isFailedPermanently())
      return { ...base, backgroundColor: '#dc3545', border: '1px solid #bd2130' };
    if (isFailing())
      return { ...base, backgroundColor: '#fd7e14', border: '1px solid #e8590c' };
    return { ...base, backgroundColor: '#fd7e14', border: '1px solid #e8590c' };
  };

  return (
    <div className={className} style={getStatusStyle()}>
      {getFriendlyMessage()}
      {isReady && kuerzel && email && (
        <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 600, opacity: 0.95 }}>
          {kuerzel} — {email}
        </div>
      )}
      {needsManualReconnect() && (
        <button
          onClick={handleReconnect}
          disabled={isReconnecting}
          style={{
            marginTop: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#dc3545',
            backgroundColor: 'white',
            border: 'none',
            borderRadius: '2px',
            cursor: isReconnecting ? 'not-allowed' : 'pointer',
            opacity: isReconnecting ? 0.6 : 1,
          }}
        >
          {isReconnecting
            ? translate('webrtc.reconnecting', 'Reconnecting…')
            : translate('webrtc.reconnectButton', 'Reconnect')}
        </button>
      )}
    </div>
  );
};

export default WebRTCConnectionStatus;
