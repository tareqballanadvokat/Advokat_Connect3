import * as React from "react";
import { Image, tokens, makeStyles } from "@fluentui/react-components";
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setLanguage, SupportedLanguage } from '@slices/languageSlice';

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
  langSwitcher: {
    display: "flex",
    gap: "4px",
    alignSelf: "flex-end",
    paddingRight: "8px",
    paddingTop: "4px",
  },
});

const langBtnBase: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: "12px",
  cursor: "pointer",
  border: "1px solid #ccc",
  borderRadius: "4px",
  background: "transparent",
};

const langBtnActive: React.CSSProperties = {
  ...langBtnBase,
  border: "1px solid #0078d4",
  background: "#0078d4",
  color: "#fff",
};

const Header: React.FC<HeaderProps> = (props: HeaderProps) => {
  const { title, logo, message } = props;
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const lang = useAppSelector(state => state.language.lang);

  const switchLang = (l: SupportedLanguage) => dispatch(setLanguage(l));

  return (
    <section className={styles.welcome__header}>
      <div className={styles.langSwitcher}>
        <button
          type="button"
          style={lang === 'de' ? langBtnActive : langBtnBase}
          onClick={() => switchLang('de')}
        >
          DE
        </button>
        <button
          type="button"
          style={lang === 'en' ? langBtnActive : langBtnBase}
          onClick={() => switchLang('en')}
        >
          EN
        </button>
      </div>
      <Image width="20" height="20" src={logo} alt={title} />
      <h1 className={styles.message}>{message}</h1>
    </section>
  );
};

export default Header;
