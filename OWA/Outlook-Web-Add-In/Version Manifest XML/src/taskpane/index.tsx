import * as React from "react";
import { createRoot } from "react-dom/client";
import config from "devextreme/core/config";
config({ licenseKey: process.env.DEVEXTREME_LICENSE_KEY });
import '../i18n'; // initialize i18next before anything else
import App from "./components/App";
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";
import { Provider } from "react-redux";
import { store } from "@store";
import { APP_VERSION } from "@config";
import { cacheService } from "@infra/cache/CacheService";
import { CACHE_KEYS, CACHE_CONFIG } from "@infra/cache/config";
import { initializeLogger, getLogger } from "@infra/logger";
import { configService } from "@config";

/* global document, Office, module, require, HTMLElement */

const title = "Advokat Task Pane Add-in";

/**
 * Check and clear cache if app version has changed
 * This prevents issues when data structures change between versions
 */
const checkAndClearCacheIfNeeded = async (logger: ReturnType<typeof getLogger>) => {
  try {
    const storedVersion = await cacheService.get<string>(
      CACHE_KEYS.APP_VERSION,
      CACHE_CONFIG[CACHE_KEYS.APP_VERSION]
    );
    
    if (storedVersion !== APP_VERSION) {
      const oldVersion = storedVersion || 'none';
      logger.info('CacheVersion', `App version changed (${oldVersion} ? ${APP_VERSION}), clearing cache`);
      
      // Clear all cache data using CacheService
      const clearedCount = await cacheService.clearAll();
      logger.info('CacheVersion', `Cleared ${clearedCount} cache entries`);
      
      // Store new version using cache service
      await cacheService.set(
        CACHE_KEYS.APP_VERSION,
        APP_VERSION,
        CACHE_CONFIG[CACHE_KEYS.APP_VERSION]
      );
      logger.info('CacheVersion', 'Version updated');
    } else {
      logger.info('CacheVersion', `Version ${APP_VERSION} matches`);
    }
  } catch (error) {
    logger.error('CacheVersion', 'Failed to check/clear cache', error);
  }
};

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(async () => {
  // Initialize logger with config
  const config = configService.getConfig();
  const logger = initializeLogger(config.logging);

  // Startup origin log — confirms whether loading from Azure or localhost
  logger.info('AppInit', `Loading from: ${window.location.origin}`);
  logger.info('AppInit', `Environment: ${config.environment}`);
  logger.info('AppInit', `SIP server: ${config.sip.wsUri}`);
  
  try {
    await checkAndClearCacheIfNeeded(logger);
  } catch (error) {
    logger.error('AppInit', 'Critical cache initialization error', error);
  }

 // 1) Spr�buj uzyc Office.context.officeTheme (Office.js 1.1+ i niekt�re hosty)
  const officeTh = (Office.context as any).officeTheme;
  let isDark = false;

  if (officeTh && officeTh.bodyBackgroundColor) {
    // wiekszosc motyw�w ciemnych ma tlo bardzo ciemne ? prosta detekcja
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

  // Expose cache statistics to window for console debugging
  (window as any).__cacheStats = () => {
    cacheService.logStatistics();
    return cacheService.getStatistics();
  };
  logger.info('App', 'Tip: Use window.__cacheStats() in console to view cache statistics');
});

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    root?.render(NextApp);
  });
}
