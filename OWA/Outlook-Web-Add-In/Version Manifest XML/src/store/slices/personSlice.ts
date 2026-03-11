// Redux slice for managing Person state
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  PersonLookUpResponse,
  PersonenQuery,
  PersonResponse,
} from "@interfaces/IPerson";
import { getWebRTCConnectionManager } from "@services/WebRTCConnectionManager";
import { cacheService, CACHE_KEYS, CACHE_CONFIG } from "@infra/cache";
import { selectIsReady, selectNotReadyReason } from "@slices/connectionSlice";
import type { RootState } from "@store";
import notify from "devextreme/ui/notify";
import { getErrorMessage } from "@utils/errorHelpers";
import { getLogger } from "@infra/logger";

const logger = getLogger();

// State interface
interface PersonState {
  // Search and lookup state
  persons: PersonLookUpResponse[];
  searchTerm: string;
  previousSearchTerm: string | null; // Track last executed query for refresh detection
  searchCounter: number; // Count consecutive searches of same term for alternating cache/API
  loading: boolean;
  error: string | null;

  // Favorites state
  favorites: PersonResponse[];
  favoritesLoading: boolean;
  addToFavoriteLoading: boolean;
  addingToFavoritePersonId: number | null; // Track which person is being added to favorites
  removeFromFavoriteLoading: boolean;
  removingFromFavoritePersonId: number | null; // Track which person is being removed from favorites
}

const initialState: PersonState = {
  // Search and lookup state
  persons: [],
  searchTerm: "",
  previousSearchTerm: null,
  searchCounter: 0,
  loading: false,
  error: null,

  // Favorites state
  favorites: [],
  favoritesLoading: false,
  addToFavoriteLoading: false,
  addingToFavoritePersonId: null,
  removeFromFavoriteLoading: false,
  removingFromFavoritePersonId: null,
};

export const personLookUpAsync = createAsyncThunk(
  "person/personLookUp",
  async (searchText: string, { getState }) => {
    const state = getState() as RootState;
    const cacheKey = `search_results:person:${searchText}`;
    const isSameSearchTerm = state.person.previousSearchTerm === searchText;
    const currentCounter = isSameSearchTerm ? state.person.searchCounter : 0;
    const forceRefresh = currentCounter % 2 === 1; // Odd counter = force refresh
    const isReady = selectIsReady(state);

    // 0. If not ready (offline or SIP not connected), skip API and use cache immediately
    if (!isReady) {
      const reason = selectNotReadyReason(state);

      try {
        const cached = await cacheService.get<PersonLookUpResponse[]>(
          cacheKey,
          CACHE_CONFIG[CACHE_KEYS.SEARCH_RESULTS]
        );

        if (cached) {
          logger.debug(`${reason}. Using cached search results for: ${searchText}`, "personSlice");
          // notify(`⚠️ ${reason}. Showing cached results.`, "warning", 4000);
          notify(`⚠️ Something went wrong, please try again.`, "warning", 4000);
          return cached;
        }
      } catch (error: unknown) {
        logger.warn(`Cache read failed while ${reason}: ` + getErrorMessage(error), "personSlice");
      }

      throw new Error(`${reason}. No cached data available. Please try again when connected.`);
    }

    // 1. Check cache if not force refresh
    if (!forceRefresh) {
      try {
        const cached = await cacheService.get<PersonLookUpResponse[]>(
          cacheKey,
          CACHE_CONFIG[CACHE_KEYS.SEARCH_RESULTS]
        );

        if (cached) {
          logger.debug("Using cached search results for: " + searchText, "personSlice");
          return cached;
        }
      } catch (error: unknown) {
        logger.warn("Cache read failed: " + getErrorMessage(error), "personSlice");
      }
    } else {
      logger.debug("Force refresh for: " + searchText, "personSlice");
    }

    // 2. Fetch from API
    logger.debug("Fetching search results from API: " + searchText, "personSlice");
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();

    try {
      const response = await webRTCApiService.personLookUp(searchText);
      if (response.statusCode === 200) {
        const data = JSON.parse(response.body || "[]") as PersonLookUpResponse[];

        // 3. Update cache only if results are not empty
        if (data.length > 0) {
          try {
            await cacheService.set(cacheKey, data, CACHE_CONFIG[CACHE_KEYS.SEARCH_RESULTS]);
            logger.debug(`Cached ${data.length} search results`, "personSlice");
          } catch (error: unknown) {
            logger.warn("Cache write failed: " + getErrorMessage(error), "personSlice");
          }
        } else {
          logger.debug("Skipping cache for empty search results", "personSlice");
        }

        return data;
      } else {
        throw new Error("Failed to lookup persons");
      }
    } catch (error: unknown) {
      // On any failure, try to return stale cached data
      try {
        const staleCache = await cacheService.get<PersonLookUpResponse[]>(
          cacheKey,
          CACHE_CONFIG[CACHE_KEYS.SEARCH_RESULTS]
        );
        if (staleCache) {
          logger.warn("API failed, returning stale cached data", "personSlice");
          // notify("Something went wrong. Showing cached results.", "warning", 4000);
            notify(`⚠️ Something went wrong, please try again.`, "warning", 4000);
          return staleCache;
        }
      } catch (cacheError: unknown) {
        logger.error(
          "Failed to retrieve stale cache: " + getErrorMessage(cacheError),
          "personSlice"
        );
      }
      throw error;
    }
  }
);

export const getFavoritePersonsAsync = createAsyncThunk(
  "person/getFavoritePersons",
  async (query: PersonenQuery) => {
    // 1. Try to get from cache first
    try {
      const cached = await cacheService.get<PersonResponse[]>(
        CACHE_KEYS.FAVORITES_PERSONS,
        CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
      );

      if (cached) {
        logger.debug("Using cached favorite persons", "personSlice");
        return cached;
      }
    } catch (error: unknown) {
      logger.warn(
        "Cache read failed, falling back to API: " + getErrorMessage(error),
        "personSlice"
      );
    }

    // 2. Cache miss or error - fetch from API
    logger.debug("Fetching favorite persons from API", "personSlice");
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();

    const response = await webRTCApiService.getFavoritePersons(query);
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body || "[]") as PersonResponse[];

      // 3. Update cache (best effort, don't fail if cache write fails)
      if (data.length > 0) {
        try {
          await cacheService.set(
            CACHE_KEYS.FAVORITES_PERSONS,
            data,
            CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
          );
        } catch (error: unknown) {
          logger.warn("Cache write failed: " + getErrorMessage(error), "personSlice");
        }
      } else {
        logger.debug("Skipping cache for empty results", "personSlice");
      }

      return data;
    } else {
      throw new Error("Failed to get favorite persons");
    }
  }
);

export const addPersonToFavoritesAsync = createAsyncThunk(
  "person/addToFavorites",
  async (personId: number, thunkAPI) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.addPersonToFavorites(personId);

    if (response.statusCode === 200) {
      // Clear favorites cache to force fresh fetch
      try {
        const username = (thunkAPI.getState() as RootState).auth?.credentials?.username;
        if (username) {
          await cacheService.clearCacheType(CACHE_KEYS.FAVORITES_PERSONS, { namespace: username });
          logger.debug("Cleared favorites cache after adding to favorites", "personSlice");
        }
      } catch (error: unknown) {
        logger.warn(
          "Cache clear failed: " + (error instanceof Error ? error.message : String(error)),
          "personSlice"
        );
      }

      // Refresh favorites from API
      await thunkAPI.dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));

      // Cache will be automatically updated by getFavoritePersonsAsync
      logger.info("Person added to favorites, cache updated", "personSlice");

      return personId;
    } else {
      throw new Error("Failed to add person to favorites");
    }
  }
);

export const removePersonFromFavoritesAsync = createAsyncThunk(
  "person/removeFromFavorites",
  async (personId: number, thunkAPI) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.removePersonFromFavorites(personId);

    if (response.statusCode === 200) {
      // Clear favorites cache to force fresh fetch
      try {
        const username = (thunkAPI.getState() as RootState).auth?.credentials?.username;
        if (username) {
          await cacheService.clearCacheType(CACHE_KEYS.FAVORITES_PERSONS, { namespace: username });
          logger.debug("Cleared favorites cache after removing from favorites", "personSlice");
        }
      } catch (error: unknown) {
        logger.warn(
          "Cache clear failed: " + (error instanceof Error ? error.message : String(error)),
          "personSlice"
        );
      }

      // Refresh favorites from API
      await thunkAPI.dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));

      // Cache will be automatically updated by getFavoritePersonsAsync
      logger.info("Person removed from favorites, cache updated", "personSlice");

      return personId;
    } else {
      throw new Error("Failed to remove person from favorites");
    }
  }
);

const personSlice = createSlice({
  name: "person",
  initialState,
  reducers: {
    clearPersons: (state) => {
      state.persons = [];
      state.favorites = [];
      state.error = null;
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearPreviousSearchTerm: (state) => {
      state.previousSearchTerm = null;
      state.searchCounter = 0;
    },
  },
  // The `extraReducers` field lets the slice handle actions defined elsewhere,
  // including actions generated by createAsyncThunk or in other slices.
  extraReducers: (builder) => {
    builder
      .addCase(personLookUpAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.searchTerm = action.meta.arg || "";
      })
      .addCase(personLookUpAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.persons = action.payload;
        const searchText = action.meta.arg;
        const isSameSearchTerm = state.previousSearchTerm === searchText;
        state.previousSearchTerm = searchText;
        // Increment counter with max limit to prevent overflow
        state.searchCounter = isSameSearchTerm ? Math.min(state.searchCounter + 1, 100) : 0;
      })
      .addCase(personLookUpAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to lookup persons via WebRTC";
      })
      .addCase(getFavoritePersonsAsync.pending, (state) => {
        state.favoritesLoading = true;
        state.error = null;
      })
      .addCase(getFavoritePersonsAsync.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        state.favorites = action.payload;
      })
      .addCase(getFavoritePersonsAsync.rejected, (state, action) => {
        state.favoritesLoading = false;
        state.error = action.error.message || "Failed to get favorite persons via WebRTC";
      })
      .addCase(addPersonToFavoritesAsync.pending, (state, action) => {
        state.addToFavoriteLoading = true;
        state.addingToFavoritePersonId = action.meta.arg; // Store the person ID being added
        state.error = null;
      })
      .addCase(addPersonToFavoritesAsync.fulfilled, (state, action) => {
        state.addToFavoriteLoading = false;
        state.addingToFavoritePersonId = null;
        // Favorites list is refreshed automatically by the async thunk
        logger.info("Person added to favorites on server: " + action.payload, "personSlice");
      })
      .addCase(addPersonToFavoritesAsync.rejected, (state, action) => {
        state.addToFavoriteLoading = false;
        state.addingToFavoritePersonId = null;
        state.error = action.error.message || "Failed to add person to favorites";
      })
      .addCase(removePersonFromFavoritesAsync.pending, (state, action) => {
        state.removeFromFavoriteLoading = true;
        state.removingFromFavoritePersonId = action.meta.arg; // Store the person ID being removed
        state.error = null;
      })
      .addCase(removePersonFromFavoritesAsync.fulfilled, (state, action) => {
        state.removeFromFavoriteLoading = false;
        state.removingFromFavoritePersonId = null;
        // Favorites list is refreshed automatically by the async thunk
        logger.info("Person removed from favorites on server: " + action.payload, "personSlice");
      })
      .addCase(removePersonFromFavoritesAsync.rejected, (state, action) => {
        state.removeFromFavoriteLoading = false;
        state.removingFromFavoritePersonId = null;
        state.error = action.error.message || "Failed to remove person from favorites";
      });
  },
});

export const { clearPersons, setSearchTerm, clearError, clearPreviousSearchTerm } =
  personSlice.actions;

export default personSlice.reducer;
