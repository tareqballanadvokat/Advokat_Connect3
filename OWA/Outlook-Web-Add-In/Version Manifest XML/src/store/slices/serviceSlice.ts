// src/store/slices/serviceSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { LeistungenAuswahlQuery, LeistungAuswahlResponse } from '../../taskpane/components/interfaces/IService';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';

// Define the state structure for service-related functionality
interface ServiceState {
  // Service section data
  abbreviation: number;
  time: string;
  text: string;
  sb: string;
  
  // Services dropdown data
  services: LeistungAuswahlResponse[];
  servicesLoading: boolean;
  servicesError: string | null;
  currentAktKuerzel: string | null; // Track which Akt's services are currently loaded
}

// Initial state
const initialState: ServiceState = {
  abbreviation: 0,
  time: '',
  text: '',
  sb: '',
  services: [],
  servicesLoading: false,
  servicesError: null,
  currentAktKuerzel: null,
};

// Async thunk for loading services
export const loadServicesAsync = createAsyncThunk(
  'service/loadServices',
  async (query: LeistungenAuswahlQuery) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.loadServices(query);
    
    if (response.response.statusCode === 200) {
      return JSON.parse(response.response.body || '[]') as LeistungAuswahlResponse[];
    } else {
      throw new Error('Failed to load services');
    }
  }
);

// Create the service slice
const serviceSlice = createSlice({
  name: 'service',
  initialState,
  reducers: {
    // Service section actions
    setAbbreviation: (state, action: PayloadAction<number>) => {
      state.abbreviation = action.payload;
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
      state.abbreviation = 0;
      state.time = '';
      state.text = '';
      state.sb = '';
    },
    // Set all service data at once (useful when loading from API)
    setServiceData: (state, action: PayloadAction<{ 
      abbreviation: number;
      time: string;
      text: string;
      sb: string;
    }>) => {
      state.abbreviation = action.payload.abbreviation;
      state.time = action.payload.time;
      state.text = action.payload.text;
      state.sb = action.payload.sb;
    },
    // Clear services
    clearServices: (state) => {
      state.services = [];
      state.servicesError = null;
      state.currentAktKuerzel = null;
      state.abbreviation = 0; // Also clear selected service
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadServicesAsync.pending, (state, action) => {
        state.servicesLoading = true;
        state.servicesError = null;
        // Store which Akt we're loading services for
        state.currentAktKuerzel = action.meta.arg.Kürzel || null;
      })
      .addCase(loadServicesAsync.fulfilled, (state, action) => {
        state.servicesLoading = false;
        state.services = action.payload;
        state.servicesError = null;
        // Keep the currentAktKuerzel to track which Akt's services we have
        // (it was already set in the pending case, so we just leave it as is)
      })
      .addCase(loadServicesAsync.rejected, (state, action) => {
        state.servicesLoading = false;
        state.servicesError = action.error.message || 'Failed to load services';
        // Clear currentAktKuerzel on error
        state.currentAktKuerzel = null;
      });
  },
});

// Export actions and reducer
export const { 
  setAbbreviation,
  setTime,
  setText,
  setSb,
  resetServiceData,
  setServiceData,
  clearServices,
} = serviceSlice.actions;

export default serviceSlice.reducer;
