// src/store/slices/serviceSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import {
  LeistungenAuswahlQuery,
  LeistungAuswahlResponse,
  LeistungPostData,
  LeistungenQuery,
  LeistungResponse,
} from "@interfaces/IService";
import { getWebRTCConnectionManager } from "@taskpane/services/WebRTCConnectionManager";
import { cacheService, CACHE_KEYS, CACHE_CONFIG } from "@services/cache";
import { selectIsReady, selectNotReadyReason } from "@slices/connectionSlice";
import type { RootState } from "@store";
import notify from "devextreme/ui/notify";
import { getErrorMessage } from "@src/taskpane/utils/errorHelpers";
import { getLogger } from "@services/logger";

const logger = getLogger();

interface ServiceState {
  // Service form data
  selectedServiceId: number;
  time: string;
  text: string;
  sb: string;

  // Services dropdown data
  services: LeistungAuswahlResponse[];
  servicesLoading: boolean;
  servicesError: string | null;

  // Save Leistung state
  saveLeistungLoading: boolean;
  saveLeistungError: string | null;

  // Saved Leistungen data
  savedLeistungen: LeistungResponse[];
  savedLeistungenLoading: boolean;
  savedLeistungenError: string | null;

  loadCounter: number;
  previousLoadKey: string | null; // Track aktId to detect changes
  registeredServicesLoading: boolean;
}

// Initial state
const initialState: ServiceState = {
  // Service form data
  selectedServiceId: 0,
  time: "",
  text: "",
  sb: "",

  // Services dropdown data
  services: [],
  servicesLoading: false,
  servicesError: null,

  // Save Leistung state
  saveLeistungLoading: false,
  saveLeistungError: null,

  // Saved Leistungen data
  savedLeistungen: [],
  savedLeistungenLoading: false,
  savedLeistungenError: null,

  loadCounter: 0,
  previousLoadKey: null,
  registeredServicesLoading: false,
};

export const loadServicesAsync = createAsyncThunk(
  "service/loadServices",
  async (query: LeistungenAuswahlQuery, { getState }) => {
    const state = getState() as RootState;

    const cacheKey = `${CACHE_KEYS.SERVICES}_${query.Kürzel || "all"}`;
    const cacheOptions = CACHE_CONFIG[CACHE_KEYS.SERVICES]; // No namespace needed for sessionStorage

    const isReady = selectIsReady(state);

    // 0. If not ready (offline or SIP not connected), skip API and use cache immediately
    if (!isReady) {
      const reason = selectNotReadyReason(state);

      try {
        const cached = await cacheService.get<LeistungAuswahlResponse[]>(cacheKey, cacheOptions);

        if (cached) {
          logger.info(
            "serviceSlice",
            `${reason}. Using cached services for Kürzel ${query.Kürzel || "all"}`
          );
          // notify(`⚠️ ${reason}. Showing cached services.`, "warning", 4000);
          notify(`⚠️ Something went wrong, please try again.`, "warning", 4000);
          return cached;
        }
      } catch (error: unknown) {
        logger.warn("serviceSlice", `Cache read failed while ${reason}`, getErrorMessage(error));
      }

      throw new Error(`${reason}. No cached data available. Please try again when connected.`);
    }

    // 1. Try to get from cache first
    try {
      const cached = await cacheService.get<LeistungAuswahlResponse[]>(cacheKey, cacheOptions);

      if (cached) {
        logger.info("serviceSlice", `Using cached services for Kürzel ${query.Kürzel || "all"}`);
        return cached;
      }
    } catch (error: unknown) {
      logger.warn("serviceSlice", "Cache read failed, falling back to API", getErrorMessage(error));
    }

    // 2. Cache miss or error - fetch from API
    logger.info("serviceSlice", `Fetching services from API for Kürzel ${query.Kürzel || "all"}`);
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();

    try {
      const response = await webRTCApiService.loadServices(query);

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body || "[]") as LeistungAuswahlResponse[];

        // 3. Update cache only if results are not empty
        if (data.length > 0) {
          try {
            await cacheService.set(cacheKey, data, cacheOptions);
            logger.info(
              "serviceSlice",
              `Cached ${data.length} services for Kürzel ${query.Kürzel || "all"}`
            );
          } catch (error: unknown) {
            logger.warn("serviceSlice", "Cache write failed", getErrorMessage(error));
          }
        } else {
          logger.info("serviceSlice", "Skipping cache for empty services list");
        }

        return data;
      } else {
        throw new Error("Failed to load services");
      }
    } catch (error) {
      // On any failure, try to return stale cached data
      try {
        const staleCache = await cacheService.get<LeistungAuswahlResponse[]>(
          cacheKey,
          cacheOptions
        );
        if (staleCache) {
          logger.warn("serviceSlice", "API failed, returning stale cached data");
          // notify("⚠️ API unavailable. Showing cached services.", "warning", 4000);
          notify(`⚠️ Something went wrong, please try again.`, "warning", 4000);
          return staleCache;
        }
      } catch (cacheError: unknown) {
        logger.error("serviceSlice", "Failed to retrieve stale cache", getErrorMessage(cacheError));
      }
      throw error;
    }
  }
);

// Async thunk for saving Leistung via WebRTC
export const saveLeistungAsync = createAsyncThunk(
  "service/saveLeistung",
  async (leistungData: LeistungPostData, thunkAPI) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.saveLeistung(leistungData);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      // Clear cache for this aktId to force fresh fetch
      if (leistungData.aktId) {
        try {
          const state = thunkAPI.getState() as RootState;
          const username = state.auth?.credentials?.username;
          if (username) {
            const cacheKey = `${CACHE_KEYS.REGISTERED_SERVICES}_${leistungData.aktId}`;
            const cacheOptions = {
              ...CACHE_CONFIG[CACHE_KEYS.REGISTERED_SERVICES],
              namespace: username,
            };
            await cacheService.remove(cacheKey, cacheOptions);
            logger.info(
              "serviceSlice",
              `Cleared registered services cache for aktId ${leistungData.aktId}`
            );
          }
        } catch (error: unknown) {
          logger.warn("serviceSlice", "Cache clear failed", getErrorMessage(error));
        }
      }

      return response;
    } else {
      throw new Error(response.body || "Failed to save service");
    }
  }
);

// Async thunk for loading saved Leistungen via WebRTC
export const loadLeistungenAsync = createAsyncThunk(
  "service/loadLeistungen",
  async (query: LeistungenQuery, { getState }) => {
    const state = getState() as RootState;
    const isReady = selectIsReady(state);

    if (!isReady) {
      const reason = selectNotReadyReason(state);
      throw new Error(`${reason}. Cannot load Leistungen.`);
    }

    // Only cache by aktId
    if (!query.aktId) {
      throw new Error("AktId is required for loading Leistungen");
    }

    const cacheKey = `${CACHE_KEYS.REGISTERED_SERVICES}_${query.aktId}`;
    const loadKey = query.aktId.toString();
    const isSameLoad = state.service.previousLoadKey === loadKey;
    const currentCounter = isSameLoad ? state.service.loadCounter : 0;
    const forceRefresh = currentCounter % 2 === 1; // Odd counter = force refresh

    const username = state.auth?.credentials?.username;
    if (!username) {
      throw new Error("User not authenticated");
    }

    const cacheOptions = {
      ...CACHE_CONFIG[CACHE_KEYS.REGISTERED_SERVICES],
      namespace: username,
    };

    // 1. Check cache if not force refresh
    if (!forceRefresh) {
      try {
        const cached = await cacheService.get<LeistungResponse[]>(cacheKey, cacheOptions);

        if (cached) {
          logger.info("serviceSlice", `Using cached registered services for aktId ${query.aktId}`);
          return cached;
        }
      } catch (error: unknown) {
        logger.warn(
          "serviceSlice",
          "Cache read failed, falling back to API",
          getErrorMessage(error)
        );
      }
    } else {
      logger.info("serviceSlice", `Force refresh for aktId ${query.aktId}`);
    }

    // 2. Fetch from API
    logger.info("serviceSlice", `Fetching registered services from API for aktId ${query.aktId}`);
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();

    try {
      const response = await webRTCApiService.getLeistungenByAkt(query);

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body || "[]") as LeistungResponse[];

        // 3. Update cache (best effort)
        if (data.length > 0) {
          try {
            await cacheService.set(cacheKey, data, cacheOptions);
            logger.info(
              "serviceSlice",
              `Cached ${data.length} registered services for aktId ${query.aktId}`
            );
          } catch (error: unknown) {
            logger.warn("serviceSlice", "Cache write failed", getErrorMessage(error));
          }
        } else {
          logger.info("serviceSlice", "Skipping cache for empty Leistungen list");
        }

        return data;
      } else {
        throw new Error("Failed to load Leistungen");
      }
    } catch (error: unknown) {
      // On any failure, try to return stale cached data
      try {
        const staleCache = await cacheService.get<LeistungResponse[]>(cacheKey, cacheOptions);
        if (staleCache) {
          logger.warn("serviceSlice", "API failed, returning stale cached data");
          // notify("⚠️ API unavailable. Showing cached services.", "warning", 4000);
          notify(`⚠️ Something went wrong, please try again.`, "warning", 4000);
          return staleCache;
        }
      } catch (cacheError: unknown) {
        logger.error("serviceSlice", "Failed to retrieve stale cache", getErrorMessage(cacheError));
      }
      throw error;
    }
  }
);

const serviceSlice = createSlice({
  name: "service",
  initialState,
  reducers: {
    setSelectedServiceId: (state, action: PayloadAction<number>) => {
      state.selectedServiceId = action.payload;
    },
    setTime: (state, action: PayloadAction<string>) => {
      state.time = action.payload;
    },
    setText: (state, action: PayloadAction<string>) => {
      state.text = action.payload;
    },
    setSb: (state, action: PayloadAction<string>) => {
      state.sb = action.payload;
    },
    // Reset service data
    resetServiceData: (state) => {
      state.selectedServiceId = 0;
      state.time = "";
      state.text = "";
      state.sb = "";
    },
    // Set all service data at once (useful when loading from API)
    setServiceData: (
      state,
      action: PayloadAction<{
        selectedServiceId: number;
        time: string;
        text: string;
        sb: string;
      }>
    ) => {
      state.selectedServiceId = action.payload.selectedServiceId;
      state.time = action.payload.time;
      state.text = action.payload.text;
      state.sb = action.payload.sb;
    },
    clearServices: (state) => {
      state.services = [];
      state.servicesError = null;
      state.selectedServiceId = 0;
    },
    setRegisteredServicesLoading: (state, action: PayloadAction<boolean>) => {
      state.registeredServicesLoading = action.payload;
    },
    clearSaveLeistungError: (state) => {
      state.saveLeistungError = null;
    },
    resetLoadCounter: (state) => {
      state.loadCounter = 0;
      state.previousLoadKey = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadServicesAsync.pending, (state) => {
        state.servicesLoading = true;
        state.servicesError = null;
      })
      .addCase(loadServicesAsync.fulfilled, (state, action) => {
        state.servicesLoading = false;
        state.services = action.payload;
        state.servicesError = null;
      })
      .addCase(loadServicesAsync.rejected, (state, action) => {
        state.servicesLoading = false;
        state.servicesError = action.error.message || "Failed to load services";
      })
      .addCase(saveLeistungAsync.pending, (state) => {
        state.saveLeistungLoading = true;
        state.saveLeistungError = null;
      })
      .addCase(saveLeistungAsync.fulfilled, (state) => {
        state.saveLeistungLoading = false;
        state.saveLeistungError = null;
        // Reset load counter to force cache refresh on next load
        state.loadCounter = 0;
      })
      .addCase(saveLeistungAsync.rejected, (state, action) => {
        state.saveLeistungLoading = false;
        state.saveLeistungError = action.error.message || "Failed to save service";
      })
      .addCase(loadLeistungenAsync.pending, (state) => {
        state.savedLeistungenLoading = true;
        state.savedLeistungenError = null;
      })
      .addCase(loadLeistungenAsync.fulfilled, (state, action) => {
        state.savedLeistungenLoading = false;
        state.savedLeistungen = action.payload;
        state.savedLeistungenError = null;

        // Update load counter for alternating cache/API pattern
        const query = action.meta.arg;
        const loadKey = query.aktId?.toString() || "";
        const isSameLoad = state.previousLoadKey === loadKey;
        state.loadCounter = isSameLoad ? Math.min(state.loadCounter + 1, 100) : 0;
        state.previousLoadKey = loadKey;
      })
      .addCase(loadLeistungenAsync.rejected, (state, action) => {
        state.savedLeistungenLoading = false;
        state.savedLeistungenError = action.error.message || "Failed to load Leistungen";
      });
  },
});

export const {
  setSelectedServiceId,
  setTime,
  setText,
  setSb,
  resetServiceData,
  setServiceData,
  clearServices,
  clearSaveLeistungError,
  resetLoadCounter,
  setRegisteredServicesLoading,
} = serviceSlice.actions;

export default serviceSlice.reducer;
