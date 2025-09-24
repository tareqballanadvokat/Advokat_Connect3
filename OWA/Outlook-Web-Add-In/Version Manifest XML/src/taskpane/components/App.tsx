import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import Tabs from './Tab';
import { DEVEXPRESS_THEME, COMPACT} from '../../config'

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

 