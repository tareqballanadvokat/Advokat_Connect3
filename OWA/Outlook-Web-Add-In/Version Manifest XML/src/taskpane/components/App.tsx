import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import Tabs from './Tab';
import { DEVEXPRESS_THEME, COMPACT} from '../../config';
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
    
    // Cleanup when add-in closes
    return () => {
      console.log('🔴 App unmounting - disconnecting WebRTC...');
      manager.disconnect();
    };
  }, []);

  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  React.useEffect(() => {
    const path =  DEVEXPRESS_THEME+`${isDarkMode ? 'dark' : 'light'}${COMPACT}.css`;
    import(
        `devextreme/dist/css/dx.${isDarkMode ? 'dark' : 'light'}.css`
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

 