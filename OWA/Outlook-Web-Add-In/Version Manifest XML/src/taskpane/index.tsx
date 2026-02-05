import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";
import { Provider } from "react-redux";
import { store } from "../store";
import { APP_VERSION } from "../config";
import { cacheService } from "../services/cache/CacheService";

/* global document, Office, module, require, HTMLElement */

const title = "Advokat Task Pane Add-in";

/**
 * Check and clear cache if app version has changed
 * This prevents issues when data structures change between versions
 */
const CACHE_VERSION_KEY = 'advokat_connect_app_version';
const checkAndClearCacheIfNeeded = async () => {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    
    if (storedVersion !== APP_VERSION) {
      console.log(`🔄 [Cache Version] App version changed (${storedVersion || 'none'} → ${APP_VERSION}), clearing cache`);
      
      // Clear all cache data using CacheService
      const clearedCount = await cacheService.clearAll();
      console.log(`✅ [Cache Version] Cleared ${clearedCount} cache entries`);
      
      // Store new version
      localStorage.setItem(CACHE_VERSION_KEY, APP_VERSION);
      console.log('✅ [Cache Version] Version updated');
    } else {
      console.log(`✅ [Cache Version] Version ${APP_VERSION} matches, no cache clear needed`);
    }
  } catch (error) {
    console.error('❌ [Cache Version] Failed to check/clear cache:', error);
  }
};

// Run cache version check before app initialization (await it to prevent race conditions)
(async () => {
  await checkAndClearCacheIfNeeded();
})().catch(err => {
  console.error('❌ [Cache Version] Failed during initialization:', err);
});

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
    <Provider store={store}>
      <FluentProvider theme={chosenTheme}>
        <App title={title} />
      </FluentProvider>
    </Provider>
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
