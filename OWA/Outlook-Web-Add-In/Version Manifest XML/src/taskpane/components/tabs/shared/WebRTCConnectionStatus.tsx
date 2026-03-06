// src/taskpane/components/tabs/shared/WebRTCConnectionStatus.tsx
import React, { useEffect } from 'react';
import { useAppSelector } from '@store/hooks';
import { selectConnectionState, selectIsReady, selectIsConnected, selectIsConnecting } from '@slices/connectionSlice';
import { getWebRTCConnectionManager } from '@services/WebRTCConnectionManager';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();

interface WebRTCConnectionStatusProps {
  className?: string;
  style?: React.CSSProperties;
}

const WebRTCConnectionStatus: React.FC<WebRTCConnectionStatusProps> = ({ className, style }) => {
  const connectionState = useAppSelector(selectConnectionState);
  const isReady = useAppSelector(selectIsReady);
  const isConnected = useAppSelector(selectIsConnected);
  const isConnecting = useAppSelector(selectIsConnecting);
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

  const isFailing = (): boolean =>
    !!(connectionState.lastError ||
      connectionState.connectionStatus.includes('Failed') ||
      connectionState.connectionStatus.includes('Error') ||
      connectionState.connectionStatus.includes('failed'));

  const getFriendlyMessage = (): string => {
    if (connectionState.idleDisconnectedAt || (!isConnecting && !isConnected && !isReady && !isFailing()))
      return translate('webrtc.disconnected');
    if (isReady) return translate('webrtc.connected');
    if (isFailedPermanently()) return translate('webrtc.connectionFailedPermanently');
    if (isFailing()) {
      const max = getWebRTCConnectionManager().getConfig().maxReconnectAttempts;
      const attempt = connectionState.reconnectAttempts;
      return translate('webrtc.connectionFailedReconnecting', { attempt, max });
    }
    return translate('webrtc.connecting');
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
    </div>
  );
};

export default WebRTCConnectionStatus;
