// Redux slice for managing Akten (Cases) state
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AktLookUpResponse, AktenQuery } from '../../taskpane/components/interfaces/IAkten';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';

// State interface
interface AktenState {
  cases: AktLookUpResponse[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  currentSearchTerm: string; // Track which search term's results are currently loaded
}

// Initial state
const initialState: AktenState = {
  cases: [],
  loading: false,
  error: null,
  searchTerm: '',
  currentSearchTerm: '' // Track which search term's results are currently loaded
};

// Real WebRTC-based async thunk for searching cases
// Thunks are commonly used for async logic like fetching data.
// The `createAsyncThunk` method is used to generate thunks that
// dispatch pending/fulfilled/rejected actions based on a promise.
// The `createSlice.extraReducers` field can handle these actions
// and update the state with the results.
export const searchAktenAsync = createAsyncThunk(
  'akten/searchAkten',
  async (searchQuery: AktenQuery) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.searchAkten(searchQuery);
    
    if (response.statusCode === 200) {
      return response.data as AktLookUpResponse[];
    } else {
      throw new Error(response.error || 'Failed to search cases');
    }
  }
);

// Fake response simulation - creates realistic JSON response and parses it
//Redux Toolkit includes a createAsyncThunk method that does all of the dispatching work (see the extraReducers) for you.
//When you use createAsyncThunk, you handle its actions in createSlice.extraReducers. 
// In this case, we handle all three action types, update the status field, and also update the value
export const searchAktenFakeAsync = createAsyncThunk(
  'akten/searchAktenFake',
  async (searchQuery: AktenQuery) => {
    // Simulate network delay
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.searchAkten(searchQuery);

    await new Promise(resolve => setTimeout(resolve, 800));
    
    let fakeResults: any[] = [];
    
    // If searching by specific AktId, return single result
    if (searchQuery.aktId) {
      fakeResults = [{
        aktId: searchQuery.aktId,
        aKurz: `ACT-${searchQuery.aktId}-2024`,
        causa: searchQuery.withCausa ? `Case for Akt ID ${searchQuery.aktId} - Specific case details` : undefined
      }];
    } else {
      // Search by Kürzel pattern - return multiple results
      fakeResults = [
        {
          aktId: 1001,
          aKurz: `${searchQuery.aKurzLike?.toUpperCase() || 'DEMO'}-2024-001`,
          causa: searchQuery.withCausa ? 'Litigation matter - Contract dispute resolution' : undefined
        },
        {
          aktId: 1002,
          aKurz: `${searchQuery.aKurzLike?.toUpperCase() || 'DEMO'}-2024-002`, 
          causa: searchQuery.withCausa ? 'Employment law case - Wrongful termination' : undefined
        },
        {
          aktId: 1003,
          aKurz: `${searchQuery.aKurzLike?.toUpperCase() || 'DEMO'}-2024-003`,
          causa: searchQuery.withCausa ? 'Corporate law - Merger and acquisition support' : undefined
        },
        {
          aktId: 1004,
          aKurz: `${searchQuery.aKurzLike?.toUpperCase() || 'DEMO'}-2023-045`,
          causa: searchQuery.withCausa ? 'Real estate transaction - Commercial property' : undefined
        }
      ].slice(0, searchQuery.count || 10); // Respect count parameter
    }
    
    // Create a fake JSON response as if received from the remote API
    const fakeJsonResponse = {
      statusCode: 200,
      data: fakeResults,
      error: null
    };
    
    // Parse JSON response as if received from WebRTC message
    const jsonString = JSON.stringify(fakeJsonResponse);
    console.log('📥 Simulated API Response JSON:', jsonString);
    
    const parsedResponse = JSON.parse(jsonString);
    return parsedResponse.data as AktLookUpResponse[];
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
      state.error = null;
      state.currentSearchTerm = ''; // Clear the cached search term
    },
    // Set current search term
    // Use the PayloadAction type to declare the contents of `action.payload`
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    // Clear any error state
    clearError: (state) => {
      state.error = null;
    }
  },
  // The `extraReducers` field lets the slice handle actions defined elsewhere,
  // including actions generated by createAsyncThunk or in other slices.
  extraReducers: (builder) => {
    builder
      // Real WebRTC search handlers
      .addCase(searchAktenAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Set currentSearchTerm when starting to load cases for this search term
        const searchQuery = action.meta.arg;
        state.currentSearchTerm = searchQuery.aKurzLike || '';
      })
      .addCase(searchAktenAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.cases = action.payload;
        // currentSearchTerm is already set in pending case, preserved here
      })
      .addCase(searchAktenAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to search cases via WebRTC';
        state.currentSearchTerm = ''; // Clear cache on error
      })
      // Fake search handlers for testing
      .addCase(searchAktenFakeAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Set currentSearchTerm when starting to load cases for this search term
        const searchQuery = action.meta.arg;
        state.currentSearchTerm = searchQuery.aKurzLike || '';
      })
      .addCase(searchAktenFakeAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.cases = action.payload;
        // currentSearchTerm is already set in pending case, preserved here
      })
      .addCase(searchAktenFakeAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to search cases (fake)';
        state.currentSearchTerm = ''; // Clear cache on error
      });
  }
});

// Export actions
export const { clearCases, setSearchTerm, clearError } = aktenSlice.actions;

// Export reducer
export default aktenSlice.reducer;
