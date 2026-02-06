import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";
import { Provider } from "react-redux";
import { store } from "../store";
import { APP_VERSION } from "../config";
import { cacheService } from "../services/cache/CacheService";
import { CACHE_KEYS, CACHE_CONFIG } from "../services/cache/config";

/* global document, Office, module, require, HTMLElement */

const title = "Advokat Task Pane Add-in";

/**
 * Check and clear cache if app version has changed
 * This prevents issues when data structures change between versions
 */
const checkAndClearCacheIfNeeded = async () => {
  try {
    const storedVersion = await cacheService.get<string>(
      CACHE_KEYS.APP_VERSION,
      CACHE_CONFIG[CACHE_KEYS.APP_VERSION]
    );
    
    if (storedVersion !== APP_VERSION) {
      const oldVersion = storedVersion || 'none';
      console.log(`🔄 [Cache Version] App version changed (${oldVersion} → ${APP_VERSION}), clearing cache`);
      
      // Clear all cache data using CacheService
      const clearedCount = await cacheService.clearAll();
      console.log(`✅ [Cache Version] Cleared ${clearedCount} cache entries`);
      
      // Store new version using cache service
      await cacheService.set(
        CACHE_KEYS.APP_VERSION,
        APP_VERSION,
        CACHE_CONFIG[CACHE_KEYS.APP_VERSION]
      );
      console.log('✅ [Cache Version] Version updated');
    } else {
      console.log(`✅ [Cache Version] Version ${APP_VERSION} matches`);
    }
  } catch (error) {
    console.error('❌ [Cache Version] Failed to check/clear cache:', error);
  }
};

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(async () => {
  try {
    await checkAndClearCacheIfNeeded();
  } catch (error) {
    console.error('❌ [App Init] Critical cache initialization error:', error);
  }

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

  // Render application
  root?.render(
    <Provider store={store}>
      <FluentProvider theme={chosenTheme}>
        <App title={title} />
      </FluentProvider>
    </Provider>
  );
});

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    root?.render(NextApp);
  });
}
