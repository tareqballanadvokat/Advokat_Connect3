// Redux slice for managing Person state
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PersonLookUpResponse, PersonenQuery } from '../../taskpane/components/interfaces/IPerson';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';

// State interface
interface PersonState {
  persons: PersonLookUpResponse[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  currentSearchTerm: string; // Track which search term's results are currently loaded
  favorites: PersonLookUpResponse[];
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

// Real WebRTC-based async thunk for searching persons
export const searchPersonsAsync = createAsyncThunk(
  'person/searchPersons',
  async (searchQuery: PersonenQuery) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.searchPersons(searchQuery);
    
    if (response.statusCode === 200) {
      return response.data as PersonLookUpResponse[];
    } else {
      throw new Error(response.error || 'Failed to search persons');
    }
  }
);

// Fake response simulation for testing
export const searchPersonsFakeAsync = createAsyncThunk(
  'person/searchPersonsFake',
  async (searchQuery: PersonenQuery) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    let fakeResults: PersonLookUpResponse[] = [];
    
    // If nurFavoriten is true, return saved favorites (simulate endpoint behavior)
    if (searchQuery.nurFavoriten) {
      // Return some fake favorites
      fakeResults = [
        {
          personId: 3001,
          nKurz: 'FAV-001',
          anzeigename: 'Johann Müller (Favorite)',
          adressdaten: {
            straße: 'Favoriten Straße 1',
            plz: '11111',
            ort: 'Vienna',
            landeskennzeichenIso2: 'AT'
          },
          kontakte: [
            { reihung: 1, art: 'Email', telefonnummerOderAdresse: 'johann.mueller@favorite.com', bemerkung: 'Work' },
            { reihung: 2, art: 'Telefon', telefonnummerOderAdresse: '+43 1 1234567', bemerkung: 'Office' }
          ]
        }
      ];
    } else {
      // Create fake persons based on search term
      const searchTerm = searchQuery.nKurzLike || searchQuery.name1Like || 'DEMO';
      
      fakeResults = [
        {
          personId: 2001,
          nKurz: `${searchTerm.toUpperCase()}-P001`,
          anzeigename: `Max Mustermann (${searchTerm})`,
          adressdaten: {
            straße: 'Musterstraße 123',
            plz: '12345',
            ort: 'Berlin',
            landeskennzeichenIso2: 'DE'
          },
          kontakte: [
            { reihung: 1, art: 'Email', telefonnummerOderAdresse: 'max.mustermann@example.com', bemerkung: 'Primary' },
            { reihung: 2, art: 'Telefon', telefonnummerOderAdresse: '+49 30 12345678', bemerkung: 'Mobile' }
          ]
        },
        {
          personId: 2002,
          nKurz: `${searchTerm.toUpperCase()}-P002`,
          anzeigename: `Anna Schmidt (${searchTerm})`,
          adressdaten: {
            straße: 'Beispielweg 456',
            plz: '54321',
            ort: 'München',
            landeskennzeichenIso2: 'DE'
          },
          kontakte: [
            { reihung: 1, art: 'Email', telefonnummerOderAdresse: 'anna.schmidt@example.com', bemerkung: 'Work' },
            { reihung: 2, art: 'Telefon', telefonnummerOderAdresse: '+49 89 87654321' }
          ]
        },
        {
          personId: 2003,
          nKurz: `${searchTerm.toUpperCase()}-P003`,
          anzeigename: `Dr. Thomas Weber (${searchTerm})`,
          adressdaten: {
            straße: 'Hauptstraße 789',
            plz: '67890',
            ort: 'Hamburg',
            landeskennzeichenIso2: 'DE'
          },
          kontakte: [
            { reihung: 1, art: 'Email', telefonnummerOderAdresse: 'thomas.weber@example.com', bemerkung: 'Work' },
            { reihung: 2, art: 'Telefon', telefonnummerOderAdresse: '+49 40 11223344' }
          ]
        }
      ];
    }

    // Respect count parameter
    fakeResults = fakeResults.slice(0, searchQuery.count || 10);
    
    // Sort contacts by reihung for each person
    fakeResults.forEach(person => {
      if (person.kontakte && person.kontakte.length > 0) {
        person.kontakte.sort((a, b) => a.reihung - b.reihung);
      }
    });
    
    return fakeResults;
  }
);

// Load favorites using the same endpoint with nurFavoriten = true
export const loadFavoritesAsync = createAsyncThunk(
  'person/loadFavorites',
  async () => {
    // Use the fake search with nurFavoriten = true to load favorites
    const searchQuery: PersonenQuery = { nurFavoriten: true };
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Return some fake favorites
    const fakeResults: PersonLookUpResponse[] = [
      {
        personId: 3001,
        nKurz: 'FAV-001',
        anzeigename: 'Johann Müller (Favorite)',
        adressdaten: {
          straße: 'Favoriten Straße 1',
          plz: '11111',
          ort: 'Vienna',
          landeskennzeichenIso2: 'AT'
        },
        kontakte: [
          { reihung: 1, art: 'Email', telefonnummerOderAdresse: 'johann.mueller@favorite.com', bemerkung: 'Work' },
          { reihung: 2, art: 'Telefon', telefonnummerOderAdresse: '+43 1 1234567', bemerkung: 'Office' }
        ]
      },
      {
        personId: 3002,
        nKurz: 'FAV-002',
        anzeigename: 'Maria Huber (Favorite)',
        adressdaten: {
          straße: 'Lieblingsweg 42',
          plz: '22222',
          ort: 'Salzburg',
          landeskennzeichenIso2: 'AT'
        },
        kontakte: [
          { reihung: 1, art: 'Email', telefonnummerOderAdresse: 'maria.huber@favorite.com' },
          { reihung: 2, art: 'Telefon', telefonnummerOderAdresse: '+43 662 987654', bemerkung: 'Mobile' },
          { reihung: 3, art: 'Website', telefonnummerOderAdresse: 'https://maria-huber.at' }
        ]
      }
    ];
    
    // Sort contacts by reihung for each person
    fakeResults.forEach(person => {
      if (person.kontakte && person.kontakte.length > 0) {
        person.kontakte.sort((a, b) => a.reihung - b.reihung);
      }
    });
    
    return fakeResults;
  }
);

// Add person to favorites
export const addPersonToFavoritesAsync = createAsyncThunk(
  'person/addToFavorites',
  async (personId: number) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.addPersonToFavorites(personId);
    
    if (response.statusCode === 200) {
      return personId;
    } else {
      throw new Error(response.error || 'Failed to add person to favorites');
    }
  }
);

// Remove person from favorites
export const removePersonFromFavoritesAsync = createAsyncThunk(
  'person/removeFromFavorites',
  async (personId: number) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.removePersonFromFavorites(personId);
    
    if (response.statusCode === 200) {
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
      state.error = null;
      state.currentSearchTerm = ''; // Clear the cached search term
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
      // Real WebRTC search handlers
      .addCase(searchPersonsAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Set currentSearchTerm when starting to load persons for this search term
        const searchQuery = action.meta.arg;
        state.currentSearchTerm = searchQuery.nKurzLike || searchQuery.name1Like || '';
      })
      .addCase(searchPersonsAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.persons = action.payload;
        // currentSearchTerm is already set in pending case, preserved here
      })
      .addCase(searchPersonsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to search persons via WebRTC';
        state.currentSearchTerm = ''; // Clear cache on error
      })
      // Fake search handlers for testing
      .addCase(searchPersonsFakeAsync.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Set currentSearchTerm when starting to load persons for this search term
        const searchQuery = action.meta.arg;
        state.currentSearchTerm = searchQuery.nKurzLike || searchQuery.name1Like || '';
      })
      .addCase(searchPersonsFakeAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.persons = action.payload;
        // currentSearchTerm is already set in pending case, preserved here
      })
      .addCase(searchPersonsFakeAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to search persons (fake)';
        state.currentSearchTerm = ''; // Clear cache on error
      })
      // Add to favorites handlers
      .addCase(addPersonToFavoritesAsync.pending, (state) => {
        state.favoritesLoading = true;
        state.error = null;
      })
      .addCase(addPersonToFavoritesAsync.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        // Find the person and add to favorites if not already there
        const person = state.persons.find(p => p.personId === action.payload);
        if (person && !state.favorites.find(f => f.personId === action.payload)) {
          // Ensure contacts are sorted when adding to favorites
          const personCopy = { ...person };
          if (personCopy.kontakte && personCopy.kontakte.length > 0) {
            personCopy.kontakte = [...personCopy.kontakte].sort((a, b) => a.reihung - b.reihung);
          }
          state.favorites.push(personCopy);
        }
      })
      .addCase(addPersonToFavoritesAsync.rejected, (state, action) => {
        state.favoritesLoading = false;
        state.error = action.error.message || 'Failed to add person to favorites';
      })
      // Remove from favorites handlers
      .addCase(removePersonFromFavoritesAsync.pending, (state) => {
        state.favoritesLoading = true;
        state.error = null;
      })
      .addCase(removePersonFromFavoritesAsync.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        // Remove person from favorites
        state.favorites = state.favorites.filter(p => p.personId !== action.payload);
      })
      .addCase(removePersonFromFavoritesAsync.rejected, (state, action) => {
        state.favoritesLoading = false;
        state.error = action.error.message || 'Failed to remove person from favorites';
      })
      // Load favorites handlers
      .addCase(loadFavoritesAsync.pending, (state) => {
        state.favoritesLoading = true;
        state.error = null;
      })
      .addCase(loadFavoritesAsync.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        state.favorites = action.payload;
      })
      .addCase(loadFavoritesAsync.rejected, (state, action) => {
        state.favoritesLoading = false;
        state.error = action.error.message || 'Failed to load favorites';
      });
  }
});

// Export actions
export const { clearPersons, setSearchTerm, clearError } = personSlice.actions;

// Export reducer
export default personSlice.reducer;
