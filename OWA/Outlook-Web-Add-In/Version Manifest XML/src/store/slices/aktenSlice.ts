// Redux slice for managing Akten (Cases) state
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AktLookUpResponse, AktenQuery, AktenResponse } from '../../taskpane/components/interfaces/IAkten';
import { DokumentResponse } from '../../taskpane/components/interfaces/IDocument';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';
import { cacheService, CACHE_KEYS, CACHE_CONFIG } from '../../services/cache';
import { StorageType } from '../../services/cache/types';
import { selectIsReady, selectNotReadyReason } from './connectionSlice';
import type { RootState } from '../index';
import notify from 'devextreme/ui/notify';
import { getErrorMessage } from '../../utils/errorHelpers';

// Interface for folder options
export interface FolderOption {
  id: number;
  text: string;
}

// State interface
interface AktenState {
  // Search and lookup state
  cases: AktLookUpResponse[]; // For search results
  searchTerm: string; // Current search term in the search box
  previousSearchTerm: string | null; // Track last executed query for refresh detection
  searchCounter: number; // Count consecutive searches of same term for alternating cache/API
  selectedAkt: AktLookUpResponse | null; // Currently selected Akt for operations
  loading: boolean;
  error: string | null;

  // Favorites state
  favouriteAkten: AktenResponse[]; // For favorite Akten from GetAllAsync endpoint (Id, AKurz, Causa)
  favoritesLoading: boolean; // Track when favorites are being loaded
  favoritesLoaded: boolean; // Track if favorites have been loaded at least once
  addToFavoriteLoading: boolean;
  addingToFavoriteAktId: number | null; // Track which akt is being added to favorites
  removeFromFavoriteLoading: boolean;
  removingFromFavoriteAktId: number | null; // Track which akt is being removed from favorites

  // Case Tab Documents state (cached in localStorage via cacheService)
  caseDocumentsLoading: boolean;
  loadingCaseDocumentsForAktId: number | null; // Track which akt is loading documents in case tab
  caseDocumentsError: string | null;

  // Email Tab Documents state (for single selected Akt)
  emailDocuments: DokumentResponse[]; // Documents for the currently selected Akt in email tab
  emailDocumentsLoadedForAktId: number | null; // Track which Akt ID the email documents were loaded for
  emailDocumentsLoadedForEmailId: string | null; // Track which email ID the documents were loaded for
  emailDocumentsLoading: boolean;
  loadingEmailDocumentsForAktId: number | null; // Track which akt is loading documents in email tab
  emailDocumentsError: string | null;

  // Folders state
  folderOptions: FolderOption[]; // Available folders for the currently selected Akt
  foldersLoadedForAktId: number | null; // Track which Akt ID the current folders were loaded for
  foldersLoading: boolean;
  foldersError: string | null;
}

// Initial state
const initialState: AktenState = {
  // Search and lookup state
  cases: [],
  searchTerm: '',
  previousSearchTerm: null,
  searchCounter: 0,
  selectedAkt: null,
  loading: false,
  error: null,

  // Favorites state
  favouriteAkten: [],
  favoritesLoading: false,
  favoritesLoaded: false,
  addToFavoriteLoading: false,
  addingToFavoriteAktId: null,
  removeFromFavoriteLoading: false,
  removingFromFavoriteAktId: null,

  // Case Tab Documents state (cached in localStorage via cacheService)
  caseDocumentsLoading: false,
  loadingCaseDocumentsForAktId: null,
  caseDocumentsError: null,

  // Email Tab Documents state (for single selected Akt)
  emailDocuments: [],
  emailDocumentsLoadedForAktId: null,
  emailDocumentsLoadedForEmailId: null,
  emailDocumentsLoading: false,
  loadingEmailDocumentsForAktId: null,
  emailDocumentsError: null,

  // Folders state
  folderOptions: [],
  foldersLoadedForAktId: null,
  foldersLoading: false,
  foldersError: null
};

// New async thunk for getting favorite Akten
export const getFavoriteAktenAsync = createAsyncThunk(
  'akten/getFavoriteAkten',
  async (query: AktenQuery) => {
    // 1. Try to get from cache first
    try {
      const cached = await cacheService.get<AktenResponse[]>(
        CACHE_KEYS.FAVORITES_AKTEN,
        CACHE_CONFIG[CACHE_KEYS.FAVORITES_AKTEN]
      );

      if (cached) {
        console.log('📦 [aktenSlice] Using cached favorite akten');
        return cached;
      }
    } catch (error: unknown) {
      console.warn('⚠️ [aktenSlice] Cache read failed, falling back to API:', getErrorMessage(error));
    }

    // 2. Cache miss or error - fetch from API
    console.log('🌐 [aktenSlice] Fetching favorite akten from API');
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.getFavoriteAkten(query);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body || '[]') as AktenResponse[];
      
      // 3. Update cache only if results are not empty
      if (data.length > 0) {
        try {
          await cacheService.set(
            CACHE_KEYS.FAVORITES_AKTEN,
            data,
            CACHE_CONFIG[CACHE_KEYS.FAVORITES_AKTEN]
          );
          console.log(`✅ [aktenSlice] Cached ${data.length} favorite akten`);
        } catch (error: unknown) {
          console.warn('⚠️ [aktenSlice] Cache write failed:', getErrorMessage(error));
        }
      } else {
        console.log('⏭️ [aktenSlice] Skipping cache for empty favorites');
      }
      
      return data;
    } else {
      throw new Error('Failed to get favorite cases');
    }
  }
);

// Async thunk for getting documents for case tab (with localStorage caching - 1 hour TTL)
export const getCaseDocumentsAsync = createAsyncThunk(
  'akten/getCaseDocuments',
  async (params: { aktId: number; Count?: number }, { getState }) => {
    const state = getState() as { auth: { credentials: { username: string | null } } };
    const username = state.auth.credentials.username;
    
    if (!username) {
      throw new Error('User not authenticated');
    }
    
    const cacheKey = `${CACHE_KEYS.DOCUMENTS}_${params.aktId}`;
    const cacheOptions = {
      ...CACHE_CONFIG[CACHE_KEYS.DOCUMENTS],
      namespace: username
    };
    
    // 1. Try to get from cache first
    try {
      const cached = await cacheService.get<DokumentResponse[]>(cacheKey, cacheOptions);

      if (cached) {
        console.log(`📦 [aktenSlice] Using cached documents for aktId ${params.aktId}`);
        return { aktId: params.aktId, documents: cached };
      }
    } catch (error: unknown) {
      console.warn('⚠️ [aktenSlice] Cache read failed, falling back to API:', getErrorMessage(error));
    }
    
    // 2. Cache miss or error - fetch from API
    console.log(`🌐 [aktenSlice] Fetching documents from API for aktId ${params.aktId}`);
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.GetDocuments({
      aktId: params.aktId,
      Count: params.Count
    });
    
    if (response.statusCode === 200) {
      const documents = JSON.parse(response.body || '[]') as DokumentResponse[];
      
      // 3. Update cache (best effort, don't fail if cache write fails)
      try {
        await cacheService.set(cacheKey, documents, cacheOptions);
      } catch (error: unknown) {
        console.warn('⚠️ [aktenSlice] Cache write failed:', getErrorMessage(error));
      }
      
      return { aktId: params.aktId, documents };
    } else {
      throw new Error('Failed to get documents for Akt');
    }
  }
);

// Async thunk for getting documents for email context (includes outlookEmailId)
export const getEmailDocumentsAsync = createAsyncThunk(
  'akten/getEmailDocuments',
  async (params: { aktId: number; outlookEmailId?: string }) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    
    // Only include outlookEmailId if it's provided and not empty
    const requestParams: any = { aktId: params.aktId };
    if (params.outlookEmailId) {
      requestParams.outlookEmailId = params.outlookEmailId;
    }
    
    const response = await webRTCApiService.GetDocuments(requestParams);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return JSON.parse(response.body || '[]') as DokumentResponse[];
    } else {
      throw new Error('Failed to get documents for email');
    }
  }
);

// New async thunk for adding Akt to favorites
export const addAktToFavoriteAsync = createAsyncThunk(
  'akten/addAktToFavorite',
  async (aktId: number, thunkAPI) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.addAktToFavorite(aktId);
    
    if (response.statusCode === 200) {
      // Clear favorites cache to force fresh fetch
      try {
        const username = (thunkAPI.getState() as RootState).auth?.credentials?.username;
        if (username) {
          await cacheService.clearCacheType(CACHE_KEYS.FAVORITES_AKTEN, { namespace: username });
          console.log('🗑️ [aktenSlice] Cleared favorites cache after adding to favorites');
        }
      } catch (error: unknown) {
        console.warn('⚠️ [aktenSlice] Cache clear failed:', error instanceof Error ? error.message : String(error));
      }
      
      // Refresh favorites from API
      await thunkAPI.dispatch(getFavoriteAktenAsync({ Count: 100, NurFavoriten: true }));
      
      // Cache will be automatically updated by getFavoriteAktenAsync
      console.log('✅ [aktenSlice] Akt added to favorites, cache updated');
      
      return aktId; // Return the aktId that was added to favorites
    } else {
      throw new Error('Failed to add Akt to favorites');
    }
  }
);

// New async thunk for removing Akt from favorites
export const removeAktFromFavoriteAsync = createAsyncThunk(
  'akten/removeAktFromFavorite',
  async (aktId: number, thunkAPI) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.removeAktFromFavorite(aktId);
    
    if (response.statusCode === 200) {
      // Clear favorites cache to force fresh fetch
      try {
        const username = (thunkAPI.getState() as RootState).auth?.credentials?.username;
        if (username) {
          await cacheService.clearCacheType(CACHE_KEYS.FAVORITES_AKTEN, { namespace: username });
          console.log('🗑️ [aktenSlice] Cleared favorites cache after removing from favorites');
        }
      } catch (error: unknown) {
        console.warn('⚠️ [aktenSlice] Cache clear failed:', error instanceof Error ? error.message : String(error));
      }
      
      // Refresh favorites from API
      await thunkAPI.dispatch(getFavoriteAktenAsync({ Count: 100, NurFavoriten: true }));
      
      // Cache will be automatically updated by getFavoriteAktenAsync
      console.log('✅ [aktenSlice] Akt removed from favorites, cache updated');
      
      return aktId; // Return the aktId that was removed from favorites
    } else {
      throw new Error('Failed to remove Akt from favorites');
    }
  }
);

export const downloadDocumentAsync = createAsyncThunk(
  'akten/downloadDocument',
  async (dokumentId: number) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const base64Content = await webRTCApiService.downloadDocument(dokumentId);
    
    if (!base64Content) {
      throw new Error('Document content is empty');
    }
    
    return base64Content; // Return the base64-encoded file content
  }
);

export const getAvailableFoldersAsync = createAsyncThunk(
  'akten/getAvailableFolders',
  async (aktId: number) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.getAvailableFolders(aktId);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      const responseData = JSON.parse(response.body || '[]');
      const folderNames = Array.isArray(responseData) 
        ? responseData.map(folder => String(folder))
        : [];
      
      // Transform folder strings to options format
      const folderOptions: FolderOption[] = folderNames.map((folderName, index) => ({
        id: index + 1, // Use index + 1 as ID
        text: folderName
      }));
      
      return folderOptions;
    } else {
      throw new Error('Failed to load available folders');
    }
  }
);

// Main async thunk for Akt lookup with text search
// Thunks are commonly used for async logic like fetching data.
// The `createAsyncThunk` method is used to generate thunks that
// dispatch pending/fulfilled/rejected actions based on a promise.
// The `createSlice.extraReducers` field can handle these actions
// and update the state with the results.
export const aktLookUpAsync = createAsyncThunk(
  'akten/aktLookUp',
  async (searchText: string, { getState }) => {
    const state = getState() as RootState;
    const cacheKey = `search_results:akt:${searchText}`;
    const isSameSearchTerm = state.akten.previousSearchTerm === searchText;
    const currentCounter = isSameSearchTerm ? state.akten.searchCounter : 0;
    const forceRefresh = currentCounter % 2 === 1; // Odd counter = force refresh
    const isReady = selectIsReady(state);

    // 0. If not ready (offline or SIP not connected), skip API and use cache immediately
    if (!isReady) {
      const reason = selectNotReadyReason(state);

      try {
        const cached = await cacheService.get<AktLookUpResponse[]>(
          cacheKey,
          CACHE_CONFIG[CACHE_KEYS.SEARCH_RESULTS]
        );

        if (cached) {
          console.log(`📴 [aktenSlice] ${reason}. Using cached search results for:`, searchText);
          notify(`⚠️ ${reason}. Showing cached results.`, 'warning', 4000);
          return cached;
        }
      } catch (error: unknown) {
        console.warn(`⚠️ [aktenSlice] Cache read failed while ${reason}:`, getErrorMessage(error));
      }

      throw new Error(`${reason}. No cached data available. Please try again when connected.`);
    }

    // 1. Check cache if not force refresh
    if (!forceRefresh) {
      try {
        const cached = await cacheService.get<AktLookUpResponse[]>(
          cacheKey,
          CACHE_CONFIG[CACHE_KEYS.SEARCH_RESULTS]
        );

        if (cached) {
          console.log('📦 [aktenSlice] Using cached search results for:', searchText);
          return cached;
        }
      } catch (error: unknown) {
        console.warn('⚠️ [aktenSlice] Cache read failed:', getErrorMessage(error));
      }
    } else {
      console.log('🔄 [aktenSlice] Force refresh for:', searchText);
    }

    // 2. Fetch from API
    console.log('🌐 [aktenSlice] Fetching search results from API:', searchText);
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    
    try {
      const response = await webRTCApiService.aktLookUp(searchText);
      
      if (response.statusCode === 200) {
        const data = JSON.parse(response.body || '[]') as AktLookUpResponse[];
        
        // 3. Update cache only if results are not empty
        if (data.length > 0) {
          try {
            await cacheService.set(
              cacheKey,
              data,
              CACHE_CONFIG[CACHE_KEYS.SEARCH_RESULTS]
            );
            console.log(`✅ [aktenSlice] Cached ${data.length} search results`);
          } catch (error: unknown) {
            console.warn('⚠️ [aktenSlice] Cache write failed:', getErrorMessage(error));
          }
        } else {
          console.log('⏭️ [aktenSlice] Skipping cache for empty search results');
        }
        
        return data;
      } else {
        throw new Error('Failed to lookup cases');
      }
    } catch (error: unknown) {
      // On any failure, try to return stale cached data
      try {
        const staleCache = await cacheService.get<AktLookUpResponse[]>(
          cacheKey,
          { storage: StorageType.SESSION }
        );
        if (staleCache) {
          console.warn('⚠️ [aktenSlice] API failed, returning stale cached data');
          notify('Something went wrong. Showing cached results.', 'warning', 4000);
          return staleCache;
        }
      } catch (cacheError: unknown) {
        console.error('❌ [aktenSlice] Failed to retrieve stale cache:', getErrorMessage(cacheError));
      }
      throw error;
    }
  }
);

// Create slice
//Redux Toolkit has a function called createSlice, 
// which takes care of the work of generating action type strings, action creator functions, and action objects. 
// All you have to do is define a name for this slice, write an object that has some reducer functions in it, 
// and it generates the corresponding action code automatically
const aktenSlice = createSlice({
  name: 'akten',
  initialState,
  reducers: {
    // Clear the cases list
    //You can only write "mutating" logic in Redux Toolkit's createSlice and createReducer 
    // because they use Immer inside! If you write mutating logic in your code without Immer,
    // it will mutate the state and cause bugs!
    // TODO rename the reducers to be compatible with the naming conventions (naming reducers as past-tense)
    // TODO ex: postAdded, actionPerformed, etc, because we're describing "an event that occurred in the application".
    clearCases: (state) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.cases = [];
      // DON'T clear favouriteAkten here - it should be managed separately
      // state.favouriteAkten = []; // ← REMOVED: This was clearing favorites unexpectedly
      state.selectedAkt = null; // Clear selected Akt when clearing search results
      state.error = null;
      state.caseDocumentsError = null;
    },
    // Clear documents for the selected Akt in email tab
    clearEmailDocuments: (state) => {
      state.emailDocuments = [];
      state.emailDocumentsLoadedForAktId = null;
      state.emailDocumentsLoadedForEmailId = null;
      state.emailDocumentsError = null;
    },
    // Clear case documents cache - note: actual cache clearing happens in thunk
    clearCaseDocuments: (state) => {
      state.caseDocumentsError = null;
    },
    // Clear favorite Akten
    clearFavorites: (state) => {
      state.favouriteAkten = [];
      state.favoritesLoaded = false;
    },
    // Clear folder options
    clearFolders: (state) => {
      state.folderOptions = [];
      state.foldersLoadedForAktId = null;
      state.foldersError = null;
    },
    // Set selected Akt
    setSelectedAkt: (state, action: PayloadAction<AktLookUpResponse | null>) => {
      state.selectedAkt = action.payload;
    },
    // Set current search term
    // Use the PayloadAction type to declare the contents of `action.payload`
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    // Clear previous search term (call when unmounting search component)
    clearPreviousSearchTerm: (state) => {
      state.previousSearchTerm = null;
      state.searchCounter = 0;
    }
  },
  // The `extraReducers` field lets the slice handle actions defined elsewhere,
  // including actions generated by createAsyncThunk or in other slices.
  extraReducers: (builder) => {
    builder
      // Get favorite Akten handlers
      .addCase(getFavoriteAktenAsync.pending, (state) => {
        state.favoritesLoading = true;
        state.error = null;
      })
      .addCase(getFavoriteAktenAsync.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        state.favoritesLoaded = true;
        state.favouriteAkten = action.payload;
      })
      .addCase(getFavoriteAktenAsync.rejected, (state, action) => {
        state.favoritesLoading = false;
        state.error = action.error.message || 'Failed to get favorite cases via WebRTC';
      })
      // Get case documents handlers (with localStorage caching)
      .addCase(getCaseDocumentsAsync.pending, (state, action) => {
        state.caseDocumentsLoading = true;
        state.loadingCaseDocumentsForAktId = action.meta.arg.aktId;
        state.caseDocumentsError = null;
      })
      .addCase(getCaseDocumentsAsync.fulfilled, (state, action) => {
        state.caseDocumentsLoading = false;
        state.loadingCaseDocumentsForAktId = null;
        console.log(`📄 Case documents loaded for Akt ${action.payload.aktId}: ${action.payload.documents.length} documents`);
      })
      .addCase(getCaseDocumentsAsync.rejected, (state, action) => {
        state.caseDocumentsLoading = false;
        state.loadingCaseDocumentsForAktId = null;
        state.caseDocumentsError = action.error.message || 'Failed to get documents for Akt';
      })
      // Get email documents handlers (single Akt, clears when Akt changes)
      .addCase(getEmailDocumentsAsync.pending, (state, action) => {
        state.emailDocumentsLoading = true;
        state.loadingEmailDocumentsForAktId = action.meta.arg.aktId;
        state.emailDocumentsError = null;
      })
      .addCase(getEmailDocumentsAsync.fulfilled, (state, action) => {
        state.emailDocumentsLoading = false;
        state.loadingEmailDocumentsForAktId = null;
        state.emailDocuments = action.payload;
        state.emailDocumentsLoadedForAktId = action.meta.arg.aktId;
        state.emailDocumentsLoadedForEmailId = action.meta.arg.outlookEmailId;
      })
      .addCase(getEmailDocumentsAsync.rejected, (state, action) => {
        state.emailDocumentsLoading = false;
        state.loadingEmailDocumentsForAktId = null;
        state.emailDocumentsError = action.error.message || 'Failed to get documents for email';
        state.emailDocumentsLoadedForAktId = null;
        state.emailDocumentsLoadedForEmailId = null;
      })
      // Add Akt to favorites handlers
      .addCase(addAktToFavoriteAsync.pending, (state, action) => {
        state.addToFavoriteLoading = true;
        state.addingToFavoriteAktId = action.meta.arg; // Store the akt ID being added
        state.error = null;
      })
      .addCase(addAktToFavoriteAsync.fulfilled, (state) => {
        state.addToFavoriteLoading = false;
        state.addingToFavoriteAktId = null;
        // The aktId was successfully added to favorites
        // We'll reload the favorites list after this action completes
      })
      .addCase(addAktToFavoriteAsync.rejected, (state, action) => {
        state.addToFavoriteLoading = false;
        state.addingToFavoriteAktId = null;
        state.error = action.error.message || 'Failed to add Akt to favorites';
      })
      // Remove Akt from favorites handlers
      .addCase(removeAktFromFavoriteAsync.pending, (state, action) => {
        state.removeFromFavoriteLoading = true;
        state.removingFromFavoriteAktId = action.meta.arg; // Store the akt ID being removed
        state.error = null;
      })
      .addCase(removeAktFromFavoriteAsync.fulfilled, (state) => {
        state.removeFromFavoriteLoading = false;
        state.removingFromFavoriteAktId = null;
        // The aktId was successfully removed from favorites
        // We'll reload the favorites list after this action completes
      })
      .addCase(removeAktFromFavoriteAsync.rejected, (state, action) => {
        state.removeFromFavoriteLoading = false;
        state.removingFromFavoriteAktId = null;
        state.error = action.error.message || 'Failed to remove Akt from favorites';
      })
      // Get available folders handlers
      .addCase(getAvailableFoldersAsync.pending, (state) => {
        state.foldersLoading = true;
        state.foldersError = null;
      })
      .addCase(getAvailableFoldersAsync.fulfilled, (state, action) => {
        state.foldersLoading = false;
        state.folderOptions = action.payload;
        state.foldersLoadedForAktId = action.meta.arg; // Track which Akt ID these folders are for
      })
      .addCase(getAvailableFoldersAsync.rejected, (state, action) => {
        state.foldersLoading = false;
        state.foldersError = action.error.message || 'Failed to load available folders';
        state.folderOptions = [];
        state.foldersLoadedForAktId = null;
      })
      // Akt lookup handlers
      .addCase(aktLookUpAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Set searchTerm for lookup search
        state.searchTerm = action.meta.arg || '';
      })
      .addCase(aktLookUpAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.cases = action.payload;
        const searchText = action.meta.arg;
        const isSameSearchTerm = state.previousSearchTerm === searchText;
        state.previousSearchTerm = searchText;
        // Increment counter with max limit to prevent overflow
        state.searchCounter = isSameSearchTerm ? Math.min(state.searchCounter + 1, 100) : 0;
      })
      .addCase(aktLookUpAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to lookup cases via WebRTC';
      });
  }
});

// Export actions
export const { clearCases, clearEmailDocuments, clearCaseDocuments, clearFavorites, clearFolders, setSelectedAkt, setSearchTerm, clearPreviousSearchTerm } = aktenSlice.actions;

// Selectors
export const selectEmailDocuments = (state: { akten: AktenState }) => state.akten.emailDocuments;

export const selectEmailDocumentsForAktAndEmail = (state: { akten: AktenState }, aktId: number, emailId?: string): DokumentResponse[] => {
  // Check if the current email documents match the requested aktId and emailId
  if (state.akten.emailDocumentsLoadedForAktId === aktId && 
      (!emailId || state.akten.emailDocumentsLoadedForEmailId === emailId)) {
    return state.akten.emailDocuments;
  }
  return [];
};

// Export reducer
export default aktenSlice.reducer;
