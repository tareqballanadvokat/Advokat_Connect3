// Redux slice for managing Person state
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PersonLookUpResponse, PersonenQuery, PersonResponse } from '../../taskpane/components/interfaces/IPerson';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';
import { cacheService, CACHE_KEYS, CACHE_CONFIG } from '../../services/cache';

// State interface
interface PersonState {
  // Search and lookup state
  persons: PersonLookUpResponse[];
  searchTerm: string;
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
  searchTerm: '',
  loading: false,
  error: null,

  // Favorites state
  favorites: [],
  favoritesLoading: false,
  addToFavoriteLoading: false,
  addingToFavoritePersonId: null,
  removeFromFavoriteLoading: false,
  removingFromFavoritePersonId: null
};

export const personLookUpAsync = createAsyncThunk(
  'person/personLookUp',
  async (searchText: string) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    
    const response = await webRTCApiService.personLookUp(searchText);
    if (response.statusCode === 200) {
      return JSON.parse(response.body || '[]') as PersonLookUpResponse[];
    } else {
      throw new Error('Failed to lookup persons');
    }
  }
);

export const getFavoritePersonsAsync = createAsyncThunk(
  'person/getFavoritePersons',
  async (query: PersonenQuery) => {
    // 1. Try to get from cache first
    const cached = await cacheService.get<PersonResponse[]>(
      CACHE_KEYS.FAVORITES_PERSONS,
      CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
    );

    if (cached) {
      console.log('📦 [personSlice] Using cached favorite persons');
      return cached;
    }

    // 2. Cache miss - fetch from API
    console.log('🌐 [personSlice] Cache miss, fetching favorite persons from API');
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    
    const response = await webRTCApiService.getFavoritePersons(query);
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body || '[]') as PersonResponse[];
      
      // 3. Update cache
      await cacheService.set(
        CACHE_KEYS.FAVORITES_PERSONS,
        data,
        CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
      );
      
      return data;
    } else {
      throw new Error('Failed to get favorite persons');
    }
  }
);

export const addPersonToFavoritesAsync = createAsyncThunk(
  'person/addToFavorites',
  async (personId: number, { dispatch }) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.addPersonToFavorites(personId);
    
    if (response.statusCode === 200) {
      // Clear cache first to force fresh fetch
      await cacheService.remove(
        CACHE_KEYS.FAVORITES_PERSONS,
        CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
      );
      
      // Refresh favorites from API
      await dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));
      
      // Cache will be automatically updated by getFavoritePersonsAsync
      console.log('✅ [personSlice] Person added to favorites, cache updated');
      
      return personId;
    } else {
      throw new Error('Failed to add person to favorites');
    }
  }
);

export const removePersonFromFavoritesAsync = createAsyncThunk(
  'person/removeFromFavorites',
  async (personId: number, { dispatch }) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.removePersonFromFavorites(personId);
    
    if (response.statusCode === 200) {
      // Clear cache first to force fresh fetch
      await cacheService.remove(
        CACHE_KEYS.FAVORITES_PERSONS,
        CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
      );
      
      // Refresh favorites from API
      await dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));
      
      // Cache will be automatically updated by getFavoritePersonsAsync
      console.log('✅ [personSlice] Person removed from favorites, cache updated');
      
      return personId;
    } else {
      throw new Error('Failed to remove person from favorites');
    }
  }
);

const personSlice = createSlice({
  name: 'person',
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
    }
  },
  // The `extraReducers` field lets the slice handle actions defined elsewhere,
  // including actions generated by createAsyncThunk or in other slices.
  extraReducers: (builder) => {
    builder
      .addCase(personLookUpAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.searchTerm = action.meta.arg || '';
      })
      .addCase(personLookUpAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.persons = action.payload;
      })
      .addCase(personLookUpAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to lookup persons via WebRTC';
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
        state.error = action.error.message || 'Failed to get favorite persons via WebRTC';
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
        console.log('✅ Person added to favorites on server:', action.payload);
      })
      .addCase(addPersonToFavoritesAsync.rejected, (state, action) => {
        state.addToFavoriteLoading = false;
        state.addingToFavoritePersonId = null;
        state.error = action.error.message || 'Failed to add person to favorites';
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
        console.log('✅ Person removed from favorites on server:', action.payload);
      })
      .addCase(removePersonFromFavoritesAsync.rejected, (state, action) => {
        state.removeFromFavoriteLoading = false;
        state.removingFromFavoritePersonId = null;
        state.error = action.error.message || 'Failed to remove person from favorites';
      });
  }
});

export const { 
  clearPersons, 
  setSearchTerm, 
  clearError
} = personSlice.actions;

export default personSlice.reducer;
