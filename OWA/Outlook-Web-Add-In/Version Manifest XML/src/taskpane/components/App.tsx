import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import Tabs from './Tab';
import { configService } from '../../config/index';
import { getWebRTCConnectionManager } from '../services/WebRTCConnectionManager';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleLogging, initializeLogging } from '../../store/slices/loggingSlice';
import { getLogger } from '../../services/logger';

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
  },
});

const App: React.FC<AppProps> = () => {
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const loggingEnabled = useAppSelector((state) => state.logging.enabled);
  const logger = getLogger();
 
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
              message: `Logging ${newState ? 'enabled' : 'disabled'}`,
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
 
  // Initialize WebRTC connection manager once at app level
  React.useEffect(() => {
    logger.info('App', 'App mounted - initializing WebRTC connection manager...');
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
  }, [logger]);

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
      <div> 
        <Tabs />
      </div>
    </div>
  );
};
 

export default App;

 