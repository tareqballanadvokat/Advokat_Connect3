import * as React from "react";
import Header from "./Header"; 
// import TextInsertion from "./original/TextInsertion";
// import { insertText } from "../taskpane";
import { makeStyles } from "@fluentui/react-components";
import { Ribbon24Regular, LockOpen24Regular, DesignIdeas24Regular } from "@fluentui/react-icons";
import Tabs from './Tab';  // importuj komponent Tabs
import { DEVEXPRESS_THEME, COMPACT} from '../../config'

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
  },
});

const App: React.FC<AppProps> =() =>{
  // (props: AppProps) => {
  const styles = useStyles();
 

  const isDarkMode = /* twoje wyliczenie */ window.matchMedia("(prefers-color-scheme: dark)").matches;

  React.useEffect(() => {
    // przy pierwszym renderze *lub* gdy isDarkMode się zmieni
    //dx.material.blue.light.compactlight.compact.cs
    //dx.material.blue.light.compact.css
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

 