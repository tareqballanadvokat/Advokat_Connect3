// Redux slice for managing Person state
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PersonLookUpResponse, PersonenQuery, PersonResponse } from '../../taskpane/components/interfaces/IPerson';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';

// State interface
interface PersonState {
  persons: PersonLookUpResponse[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  currentSearchTerm: string; // Track which search term's results are currently loaded
  favorites: PersonResponse[]; // For favorite persons from GetAllAsync endpoint
  favoritesLoading: boolean;
}

// Initial state
const initialState: PersonState = {
  persons: [],
  loading: false,
  error: null,
  searchTerm: '',
  currentSearchTerm: '', // Track which search term's results are currently loaded
  favorites: [],
  favoritesLoading: false
};

// Main async thunk for Person lookup with text search
export const personLookUpAsync = createAsyncThunk(
  'person/personLookUp',
  async (searchText: string) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    
    try {
      const response = await webRTCApiService.personLookUp(searchText);
      throw new Error('Failed to lookup persons');
      if (response.statusCode === 200) {
        return response.data as PersonLookUpResponse[];
      } else {
        throw new Error(response.error || 'Failed to lookup persons');
      }
    } catch (error) {
      // If WebRTC fails, provide fake data for testing
      console.log('🔧 WebRTC person lookup failed, providing fake data for testing');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Create fake search results based on search text
      const fakeResults = [
        {
          PersonId: 2001,
          NKurz: `${searchText?.toUpperCase() || 'DEMO'}-P001`,
          IstFirma: false,
          Titel: 'Dr.',
          Vorname: 'Max',
          Name1: 'Mustermann',
          Name2: searchText ? `(${searchText})` : undefined,
          Adresse: {
            straße: 'Musterstraße 123',
            plz: '12345',
            ort: 'Berlin',
            landeskennzeichenIso2: 'DE'
          },
          Kontakte: [
            { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'max.mustermann@example.com', Bemerkung: 'Primary' },
            { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 30 12345678', Bemerkung: 'Mobile' }
          ]
        },
        {
          PersonId: 2002,
          NKurz: `${searchText?.toUpperCase() || 'DEMO'}-P002`,
          IstFirma: false,
          Vorname: 'Anna',
          Name1: 'Schmidt',
          Adresse: {
            straße: 'Beispielweg 456',
            plz: '54321',
            ort: 'München',
            landeskennzeichenIso2: 'DE'
          },
          Kontakte: [
            { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'anna.schmidt@example.com' },
            { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 89 87654321' }
          ]
        }
      ].slice(0, 10); // Limit to 10 results
      
      console.log('📥 Using fake person response data:', fakeResults);
      return fakeResults as PersonLookUpResponse[];
    }
  }
);

// New async thunk for getting favorite persons
export const getFavoritePersonsAsync = createAsyncThunk(
  'person/getFavoritePersons',
  async (query: PersonenQuery) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    
    try {
      throw new Error('Failed to get favorite persons');
      const response = await webRTCApiService.getFavoritePersons(query);
      if (response.statusCode === 200) {
        return response.data as PersonResponse[];
      } else {
        throw new Error(response.error || 'Failed to get favorite persons');
      }
    } catch (error) {
      // If WebRTC fails, provide fake favorite persons for testing
      console.log('🔧 WebRTC get favorite persons failed, providing fake data for testing');

      // Create fake favorite persons using PersonResponse structure (Id, Adressdaten)
      const fakeFavorites = [
        {
          Id: 3001,
          NKurz: 'FAV-P001',
          IstFirma: false,
          Titel: 'Dr.',
          Vorname: 'Maria',
          Name1: 'Favorit',
          Name2: 'Client',
          Adressdaten: {
            straße: 'Hauptstraße 789',
            plz: '10115',
            ort: 'Berlin',
            landeskennzeichenIso2: 'DE'
          },
          Kontakte: [
            { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'maria.favorit@example.com', Bemerkung: 'Business' },
            { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 30 55555555', Bemerkung: 'Office' }
          ]
        },
        {
          Id: 3002,
          NKurz: 'FAV-P002',
          IstFirma: true,
          Name1: 'Musterfirma',
          Name2: 'GmbH',
          Adressdaten: {
            straße: 'Geschäftsstraße 456',
            plz: '20095',
            ort: 'Hamburg',
            landeskennzeichenIso2: 'DE'
          },
          Kontakte: [
            { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'info@musterfirma.de', Bemerkung: 'Main' },
            { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 40 66666666', Bemerkung: 'Reception' },
            { Reihung: 3, Art: 'Website', TelefonnummerOderAdresse: 'https://www.musterfirma.de' }
          ]
        },
        {
          Id: 3003,
          NKurz: 'FAV-P003',
          IstFirma: false,
          Vorname: 'Thomas',
          Name1: 'Stammkunde',
          Adressdaten: {
            straße: 'Kundenweg 123',
            plz: '80331',
            ort: 'München',
            landeskennzeichenIso2: 'DE'
          },
          Kontakte: [
            { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'thomas.stammkunde@email.de' },
            { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 89 77777777', Bemerkung: 'Mobile' }
          ]
        }
      ];
      
      console.log('📥 Using fake favorite persons response data:', fakeFavorites);
      return fakeFavorites as PersonResponse[];
    }
  }
);

// Add person to favorites - calls API and refreshes favorites list
export const addPersonToFavoritesAsync = createAsyncThunk(
  'person/addToFavorites',
  async (personId: number, { dispatch }) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.addPersonToFavorites(personId);
    
    if (response.statusCode === 200) {
      // Refresh favorites list after successful addition
      dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));
      return personId;
    } else {
      throw new Error(response.error || 'Failed to add person to favorites');
    }
  }
);

// Remove person from favorites - calls API and refreshes favorites list
export const removePersonFromFavoritesAsync = createAsyncThunk(
  'person/removeFromFavorites',
  async (personId: number, { dispatch }) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.removePersonFromFavorites(personId);
    
    if (response.statusCode === 200) {
      // Refresh favorites list after successful removal
      dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));
      return personId;
    } else {
      throw new Error(response.error || 'Failed to remove person from favorites');
    }
  }
);

// Create slice
const personSlice = createSlice({
  name: 'person',
  initialState,
  reducers: {
    // Clear the persons list
    clearPersons: (state) => {
      state.persons = [];
      state.favorites = [];
      state.error = null;
      state.currentSearchTerm = '';
    },
    // Set current search term
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
      // Person lookup handlers
      .addCase(personLookUpAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Set currentSearchTerm for lookup search
        state.currentSearchTerm = action.meta.arg || '';
      })
      .addCase(personLookUpAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.persons = action.payload;
      })
      .addCase(personLookUpAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to lookup persons via WebRTC';
        state.currentSearchTerm = ''; // Clear cache on error
      })
      // Get favorite persons handlers
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
      // Add to favorites handlers
      .addCase(addPersonToFavoritesAsync.fulfilled, (_state, action) => {
        // Favorites list is refreshed automatically by the async thunk
        console.log('✅ Person added to favorites on server:', action.payload);
      })
      .addCase(addPersonToFavoritesAsync.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to add person to favorites';
      })
      // Remove from favorites handlers
      .addCase(removePersonFromFavoritesAsync.fulfilled, (_state, action) => {
        // Favorites list is refreshed automatically by the async thunk
        console.log('✅ Person removed from favorites on server:', action.payload);
      })
      .addCase(removePersonFromFavoritesAsync.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to remove person from favorites';
      });
  }
});

// Export actions
export const { 
  clearPersons, 
  setSearchTerm, 
  clearError
} = personSlice.actions;

// Export reducer
export default personSlice.reducer;
