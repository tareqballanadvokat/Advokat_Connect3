import * as React from "react";
import { Image, tokens, makeStyles } from "@fluentui/react-components";

export interface HeaderProps {
  title: string;
  logo: string;
  message: string;
}

const useStyles = makeStyles({
  welcome__header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingBottom: "0px",
    paddingTop: "0px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  message: {
    fontSize: tokens.fontSizeHero900,
    fontWeight: tokens.fontWeightRegular,
    fontColor: tokens.colorNeutralBackgroundStatic,
  },
});

const Header: React.FC<HeaderProps> = (props: HeaderProps) => {
  const { title, logo, message } = props;
  const styles = useStyles();

  return (

    <section className={styles.welcome__header}>
      SipClient();
      <Image width="20" height="20" src={logo} alt={title} />
      <h1 className={styles.message}>{message}</h1>
      <button type="button">Click Me!</button>
     
    </section>
  );
};

export default Header;
