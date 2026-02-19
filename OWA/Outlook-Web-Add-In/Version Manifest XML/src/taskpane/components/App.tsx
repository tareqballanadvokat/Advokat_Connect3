import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import Tabs from './Tab';
import { configService } from '../../config/index';
import { getWebRTCConnectionManager } from '../services/WebRTCConnectionManager';

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
 
  // Initialize WebRTC connection manager once at app level
  React.useEffect(() => {
    console.log('🚀 App mounted - initializing WebRTC connection manager...');
    const manager = getWebRTCConnectionManager();
    manager.initialize().catch(error => {
      console.error('❌ Failed to initialize WebRTC connection:', error);
    });
    
    let isDisconnected = false;
    
    // Handle window/tab close - disconnect gracefully
    const handleUnload = () => {
      if (!isDisconnected) {
        console.log('🔴 Window closing - disconnecting WebRTC...');
        isDisconnected = true;
        manager.disconnect();
      }
    };

    window.addEventListener('unload', handleUnload);
    
    // Cleanup when add-in closes
    return () => {
      if (!isDisconnected) {
        console.log('🔴 App unmounting - disconnecting WebRTC...');
        isDisconnected = true;
        manager.disconnect();
      }
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

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

 