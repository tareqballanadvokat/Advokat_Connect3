import * as React from "react";
import Header from "./Header";
import HeroList, { HeroListItem } from "./HeroList";
// import TextInsertion from "./original/TextInsertion";
// import { insertText } from "../taskpane";
import { makeStyles } from "@fluentui/react-components";
import { Ribbon24Regular, LockOpen24Regular, DesignIdeas24Regular } from "@fluentui/react-icons";
import Tabs from './Tab';  // importuj komponent Tabs


interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
  },
});

const App: React.FC<AppProps> = (props: AppProps) => {
  const styles = useStyles();
 

  const isDarkMode = /* twoje wyliczenie */ window.matchMedia("(prefers-color-scheme: dark)").matches;

  React.useEffect(() => {
    // przy pierwszym renderze *lub* gdy isDarkMode się zmieni
    import(
      /* webpackChunkName: "dx-theme" */
      `devextreme/dist/css/dx.${isDarkMode ? 'dark' : 'light'}.css`
    );
  }, [isDarkMode]);



  // The list items are static and won't change at runtime,
  // so this should be an ordinary const, not a part of state.
  const listItems: HeroListItem[] = [
    {
      icon: <Ribbon24Regular />,
      primaryText: "Achieve more with Office integration",
    },
    {
      icon: <LockOpen24Regular />,
      primaryText: "Unlock features and functionality",
    },
    {
      icon: <DesignIdeas24Regular />,
      primaryText: "Create and visualize like a pro",
    },
  ];

  return (
    <div className={styles.root}>
    <div> 
       <Tabs />
     </div>
      <Header logo="assets/a_3.png" title={props.title} message="Welcome" />
      <HeroList message="Discover what this add-in can do for you today!" items={listItems} />
      {/* <TextInsertion insertText={insertText} /> */}
    </div>
  );
};
 

export default App;

 