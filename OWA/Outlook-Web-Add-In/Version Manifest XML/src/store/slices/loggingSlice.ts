// src/store/slices/loggingSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { LogLevel } from "@config/types";
import { getLogger } from "@infra/logger";
import { configService } from "@config";

/**
 * Logging State Interface
 */
export interface ILoggingState {
  enabled: boolean;
  level: LogLevel;
}

/**
 * Initial state - reads from config defaults
 */
const config = configService.getConfig();
const initialState: ILoggingState = {
  enabled: config.logging.enabled,
  level: config.logging.level,
};

const loggingSlice = createSlice({
  name: "logging",
  initialState,
  reducers: {
    /**
     * Initialize logging state from config
     */
    initializeLogging: (state, action: PayloadAction<{ enabled: boolean; level: LogLevel }>) => {
      state.enabled = action.payload.enabled;
      state.level = action.payload.level;
      
      // Sync logger instance with config
      const logger = getLogger();
      logger.updateConfig({
        enabled: action.payload.enabled,
        level: action.payload.level,
        includeTimestamp: true,
        includeStack: true,
      });
    },

    /**
     * Toggle logging on/off
     */
    toggleLogging: (state) => {
      state.enabled = !state.enabled;
      console.log('[loggingSlice] toggleLogging - new enabled state:', state.enabled);
      const logger = getLogger();
      if (state.enabled) {
        logger.enable();
      } else {
        logger.disable();
      }
    },

    /**
     * Enable logging
     */
    enableLogging: (state) => {
      state.enabled = true;
      getLogger().enable();
    },

    /**
     * Disable logging
     */
    disableLogging: (state) => {
      state.enabled = false;
      getLogger().disable();
    },

    /**
     * Set log level
     */
    setLogLevel: (state, action: PayloadAction<LogLevel>) => {
      state.level = action.payload;
      getLogger().setLevel(action.payload);
    },
  },
});

export const { initializeLogging, toggleLogging, enableLogging, disableLogging, setLogLevel } =
  loggingSlice.actions;

export default loggingSlice.reducer;
