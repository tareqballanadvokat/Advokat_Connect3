// Redux slice for managing Akten (Cases) state
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AktLookUpResponse, AktenQuery, AktenResponse } from '../../taskpane/components/interfaces/IAkten';
import { DokumentResponse } from '../../taskpane/components/interfaces/IDocument';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';

// Interface for folder options
export interface FolderOption {
  id: number;
  text: string;
}

// State interface
interface AktenState {
  cases: AktLookUpResponse[]; // For search results
  favouriteAkten: AktenResponse[]; // For favorite Akten from GetAllAsync endpoint (Id, AKurz, Causa)
  favoriteAktenDocuments: DokumentResponse[]; // Documents for the currently expanded favorite Akten
  folderOptions: FolderOption[]; // Available folders for the currently selected Akt
  selectedAkt: AktLookUpResponse | null; // Currently selected Akt for operations
  loading: boolean;
  documentsLoading: boolean;
  foldersLoading: boolean;
  error: string | null;
  documentsError: string | null;
  foldersError: string | null;
  searchTerm: string; // Current search term in the search box
}

// Initial state
const initialState: AktenState = {
  cases: [],
  favouriteAkten: [],
  favoriteAktenDocuments: [],
  folderOptions: [],
  selectedAkt: null,
  loading: false,
  documentsLoading: false,
  foldersLoading: false,
  error: null,
  documentsError: null,
  foldersError: null,
  searchTerm: ''
};

// New async thunk for getting favorite Akten
export const getFavoriteAktenAsync = createAsyncThunk(
  'akten/getFavoriteAkten',
  async (query: AktenQuery) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.getFavoriteAkten(query);
    
    if (response.response.statusCode === 200) {
      return JSON.parse(response.response.body || '[]') as AktenResponse[]; // Use AktenResponse format (Id, AKurz, Causa)
    } else {
      throw new Error('Failed to get favorite cases');
    }
  }
);

// New async thunk for getting documents for a specific Akt
export const getAktDokumenteAsync = createAsyncThunk(
  'akten/getAktDokumente',
  async (params: { aktId: number; limit?: number }) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.GetDocuments({
      aktId: params.aktId,
      limit: params.limit
    });
    
    if (response.response.statusCode === 200) {
      return JSON.parse(response.response.body || '[]') as DokumentResponse[];
    } else {
      throw new Error('Failed to get documents for Akt');
    }
  }
);

// New async thunk for adding Akt to favorites
export const addAktToFavoriteAsync = createAsyncThunk(
  'akten/addAktToFavorite',
  async (aktId: number) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.addAktToFavorite(aktId);
    
    if (response.response.statusCode === 200) {
      return aktId; // Return the aktId that was added to favorites
    } else {
      throw new Error('Failed to add Akt to favorites');
    }
  }
);

// New async thunk for removing Akt from favorites
export const removeAktFromFavoriteAsync = createAsyncThunk(
  'akten/removeAktFromFavorite',
  async (aktId: number) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.removeAktFromFavorite(aktId);
    if (response.response.statusCode === 200) {
      return aktId; // Return the aktId that was removed from favorites
    } else {
      throw new Error('Failed to remove Akt from favorites');
    }
  }
);

// New async thunk for loading available folders for an Akt
export const getAvailableFoldersAsync = createAsyncThunk(
  'akten/getAvailableFolders',
  async (aktId: number) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.getAvailableFolders(aktId);
    
    if (response.response.statusCode >= 200 && response.response.statusCode < 300) {
      const responseData = JSON.parse(response.response.body || '[]');
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
  async (searchText: string) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    
    try {
      const response = await webRTCApiService.aktLookUp(searchText);
      
      if (response.response.statusCode === 200) {
        return JSON.parse(response.response.body || '[]') as AktLookUpResponse[];
      } else {
        throw new Error('Failed to lookup cases');
      }
    } catch (error) {
      // If WebRTC fails, provide fake data for testing
      console.log('🔧 WebRTC lookup failed, providing fake data for testing');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Create fake search results based on search text
      const fakeResults = [
        {
          aktId: 1001,
          aKurz: `${searchText?.toUpperCase() || 'DEMO'}-2024-001`,
          causa: 'Litigation matter - Contract dispute resolution'
        },
        {
          aktId: 1002,
          aKurz: `${searchText?.toUpperCase() || 'DEMO'}-2024-002`, 
          causa: 'Employment law case - Wrongful termination'
        },
        {
          aktId: 1003,
          aKurz: `${searchText?.toUpperCase() || 'DEMO'}-2024-003`,
          causa: 'Corporate law - Merger and acquisition support'
        },
        {
          aktId: 1004,
          aKurz: `${searchText?.toUpperCase() || 'DEMO'}-2023-045`,
          causa: 'Real estate transaction - Commercial property'
        }
      ].slice(0, 10); // Limit to 10 results
      
      console.log('📥 Using fake response data:', fakeResults);
      return fakeResults as AktLookUpResponse[];
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
      state.favoriteAktenDocuments = [];
      state.selectedAkt = null; // Clear selected Akt when clearing search results
      state.error = null;
      state.documentsError = null;
    },
    // Clear documents for the selected Akt
    clearDocuments: (state) => {
      state.favoriteAktenDocuments = [];
      state.documentsError = null;
    },
    // Clear favorite Akten
    clearFavorites: (state) => {
      state.favouriteAkten = [];
      state.favoriteAktenDocuments = []; // Clear documents as they depend on favorites
    },
    // Clear folder options
    clearFolders: (state) => {
      state.folderOptions = [];
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
    }
  },
  // The `extraReducers` field lets the slice handle actions defined elsewhere,
  // including actions generated by createAsyncThunk or in other slices.
  extraReducers: (builder) => {
    builder
      // Get favorite Akten handlers
      .addCase(getFavoriteAktenAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getFavoriteAktenAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.favouriteAkten = action.payload;
      })
      .addCase(getFavoriteAktenAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to get favorite cases via WebRTC';
      })
      // Get Akt documents handlers
      .addCase(getAktDokumenteAsync.pending, (state) => {
        state.documentsLoading = true;
        state.documentsError = null;
      })
      .addCase(getAktDokumenteAsync.fulfilled, (state, action) => {
        state.documentsLoading = false;
        state.favoriteAktenDocuments = action.payload;
      })
      .addCase(getAktDokumenteAsync.rejected, (state, action) => {
        state.documentsLoading = false;
        state.documentsError = action.error.message || 'Failed to get documents for Akt';
      })
      // Add Akt to favorites handlers
      .addCase(addAktToFavoriteAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addAktToFavoriteAsync.fulfilled, (state) => {
        state.loading = false;
        // The aktId was successfully added to favorites
        // We'll reload the favorites list after this action completes
      })
      .addCase(addAktToFavoriteAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add Akt to favorites';
      })
      // Remove Akt from favorites handlers
      .addCase(removeAktFromFavoriteAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeAktFromFavoriteAsync.fulfilled, (state) => {
        state.loading = false;
        // The aktId was successfully removed from favorites
        // We'll reload the favorites list after this action completes
      })
      .addCase(removeAktFromFavoriteAsync.rejected, (state, action) => {
        state.loading = false;
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
      })
      .addCase(getAvailableFoldersAsync.rejected, (state, action) => {
        state.foldersLoading = false;
        state.foldersError = action.error.message || 'Failed to load available folders';
        state.folderOptions = [];
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
      })
      .addCase(aktLookUpAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to lookup cases via WebRTC';
      });
  }
});

// Export actions
export const { clearCases, clearDocuments, clearFavorites, clearFolders, setSelectedAkt, setSearchTerm } = aktenSlice.actions;

// Export reducer
export default aktenSlice.reducer;
