import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import { useTranslation } from 'react-i18next';
import Tabs from './Tab';
import PairingDialog from './tabs/shared/PairingDialog';
import { configService } from '@config';
import { setAdvokatServerId } from '@config/runtimeConfig';
import { getWebRTCConnectionManager } from '@services/WebRTCConnectionManager';
import { officeAuthService } from '@services/OfficeAuthService';
import { pairingApiService } from '@services/PairingApiService';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { selectPairingStatus, selectAdvokatServerId } from '@slices/pairingSlice';
import { toggleLogging, initializeLogging } from '@slices/loggingSlice';
import { getLogger } from '@infra/logger';

interface AppProps {
  title: string;
}

const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
  },
  envBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.3px",
    backgroundColor: isLocalhost ? "#fff3cd" : "#d4edda",
    color: isLocalhost ? "#856404" : "#155724",
    borderBottom: isLocalhost ? "1px solid #ffc107" : "1px solid #28a745",
  },
  envDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    display: "inline-block",
    backgroundColor: isLocalhost ? "#ffc107" : "#28a745",
    flexShrink: 0,
  },
});

const App: React.FC<AppProps> = () => {
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const loggingEnabled = useAppSelector((state) => state.logging.enabled);
  const pairingStatus = useAppSelector(selectPairingStatus);
  const advokatServerId = useAppSelector(selectAdvokatServerId);
  const logger = getLogger();
  const { t: translate } = useTranslation('common');
 
  // Step 1: Fetch Office SSO token → Step 2: Check pairing status
  React.useEffect(() => {
    (async () => {
      // Pre-flight: check if OfficeRuntime SSO is available in this environment
      const officeRuntimeAvailable = typeof OfficeRuntime !== 'undefined' && !!OfficeRuntime?.auth?.getAccessToken;
      const officeJsReady = typeof Office !== 'undefined' && !!Office?.context;
      logger.info('App', `Office environment check — OfficeRuntime.auth available: ${officeRuntimeAvailable}, Office.context ready: ${officeJsReady}`);

      if (!officeRuntimeAvailable) {
        logger.warn('App', 'OfficeRuntime.auth.getAccessToken is not available in this environment (running outside Outlook or on an unsupported host). Skipping SSO.');
        return;
      }

      logger.info('App', 'Calling officeAuthService.getOfficeToken()...');
      const officeToken = await officeAuthService.getOfficeToken();

      if (!officeToken) {
        // OfficeAuthService already logged the specific error code — repeat the key facts here for correlation
        logger.warn('App', 'getOfficeToken() returned null. Check the OfficeAuthService error log above for the exact error code (13001–13012). Skipping pairing check.');
        return;
      }

      logger.info('App', 'Office token obtained successfully. Proceeding to pairing check...');

      try {
        const result = await pairingApiService.checkServerId(officeToken);
        if (result) {
          logger.info('App', `Pairing check complete — advokatServerId: ${result.advokatServerId}`);
        } else {
          logger.info('App', 'Pairing check complete — user is not yet paired (first-time setup).');
        }
      } catch (error: unknown) {
        logger.error('App', 'Pairing API check failed', error);
      }
    })();
  }, [logger]);

  // Initialize logging from config
  React.useEffect(() => {
    const config = configService.getConfig();
    dispatch(initializeLogging({
      enabled: config.logging.enabled,
      level: config.logging.level,
    }));
  }, [dispatch]);

  // Keyboard shortcut: Ctrl+Shift+L to toggle logging
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+L
      if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        console.log('[App] Ctrl+Shift+L pressed - toggling logging. Current state:', loggingEnabled);
        dispatch(toggleLogging());
        
        // Show notification with correct new state
        const newState = !loggingEnabled;
        console.log('[App] New logging state will be:', newState);
        if (Office?.context?.mailbox?.item?.notificationMessages) {
          Office.context.mailbox.item.notificationMessages.replaceAsync(
            "LoggingToggleNotification",
            {
              type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
              message: newState ? translate('logging.enabled') : translate('logging.disabled'),
              icon: "Icon.80x80",
              persistent: false,
            }
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, loggingEnabled]);
 
  // Initialize WebRTC connection manager once the ADVOKAT Server is known.
  // advokatServerId comes from pairingSlice (set by either checkServerId() for
  // returning users or pair() after the OTP dialog for first-time users) and is
  // patched into sipConfig.toDisplayName so it is sent in the REGISTER "To:" header.
  React.useEffect(() => {
    if (!advokatServerId) {
      logger.info('App', 'Waiting for advokatServerId before initializing WebRTC connection manager...');
      return undefined;
    }

    logger.info('App', `advokatServerId resolved (${advokatServerId}) - initializing WebRTC connection manager...`);
    setAdvokatServerId(advokatServerId);

    const manager = getWebRTCConnectionManager();
    manager.initialize().catch(error => {
      logger.error('App', 'Failed to initialize WebRTC connection', error);
    });

    let isDisconnected = false;
    
    // Handle window/tab close - disconnect gracefully
    const handleUnload = () => {
      if (!isDisconnected) {
        logger.info('App', 'Window closing - disconnecting WebRTC...');
        isDisconnected = true;
        manager.disconnect();
      }
    };

    window.addEventListener('unload', handleUnload);
    
    // Cleanup when add-in closes
    return () => {
      if (!isDisconnected) {
        logger.info('App', 'App unmounting - disconnecting WebRTC...');
        isDisconnected = true;
        manager.disconnect();
      }
      window.removeEventListener('unload', handleUnload);
    };
  }, [logger, advokatServerId]);

  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  React.useEffect(() => {
    const theme = configService.getConfig().theme;
    const compact = theme.compact ? '.compact' : '';
    const themePath = `${theme.name}${isDarkMode ? 'dark' : 'light'}${compact}.css`;
    
    import(
        `devextreme/dist/css/dx.${isDarkMode ? 'dark' : 'light'}${compact}.css`
    );
  }, [isDarkMode]);


  return (
    <div className={styles.root}>
      <div className={styles.envBanner}>
        <span className={styles.envDot} />
        {isLocalhost
          ? `LOCAL — ${window.location.origin}`
          : `AZURE — ${window.location.origin}`}
      </div>
      {pairingStatus === 'unpaired' && <PairingDialog />}
      <div> 
        <Tabs />
      </div>
    </div>
  );
};
 

export default App;

 