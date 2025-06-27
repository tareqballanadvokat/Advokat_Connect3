import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";

/* global document, Office, module, require, HTMLElement */

const title = "Advokat Task Pane Add-in";

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {

 // 1) Spróbuj użyć Office.context.officeTheme (Office.js 1.1+ i niektóre hosty)
  const officeTh = (Office.context as any).officeTheme;
  let isDark = false;

  if (officeTh && officeTh.bodyBackgroundColor) {
    // większość motywów ciemnych ma tło bardzo ciemne ⇒ prosta detekcja
    const bg = officeTh.bodyBackgroundColor.toLowerCase();
    isDark = (bg === "#000000" || bg === "black" || bg.startsWith("#") && parseInt(bg.substr(1),16) < 0x444444);
  } else if (window.matchMedia) {
    // 2) fallback na prefers-color-scheme (Outlook Web / Edge WebView2)
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  const chosenTheme = isDark ? webDarkTheme : webLightTheme;

  root?.render(
    <FluentProvider theme={chosenTheme}>
      <App title={title} />
    </FluentProvider>
  );


  // root?.render(
  //   <FluentProvider theme={webLightTheme}>
  //     <App title={title} />
  //   </FluentProvider>
  // );
});

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    root?.render(NextApp);
  });
}
