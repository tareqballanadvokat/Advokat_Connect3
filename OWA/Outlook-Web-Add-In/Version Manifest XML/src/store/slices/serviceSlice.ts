// src/store/slices/serviceSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { LeistungenAuswahlQuery, LeistungAuswahlResponse } from '../../taskpane/components/interfaces/IService';
import { getWebRTCConnectionManager } from '../../taskpane/services/WebRTCConnectionManager';

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
}

// Initial state
const initialState: ServiceState = {
  // Service form data
  selectedServiceId: 0,
  time: '',
  text: '',
  sb: '',

  // Services dropdown data
  services: [],
  servicesLoading: false,
  servicesError: null,
};

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

const serviceSlice = createSlice({
  name: 'service',
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
      state.time = '';
      state.text = '';
      state.sb = '';
    },
    // Set all service data at once (useful when loading from API)
    setServiceData: (state, action: PayloadAction<{ 
      selectedServiceId: number;
      time: string;
      text: string;
      sb: string;
    }>) => {
      state.selectedServiceId = action.payload.selectedServiceId;
      state.time = action.payload.time;
      state.text = action.payload.text;
      state.sb = action.payload.sb;
    },
    clearServices: (state) => {
      state.services = [];
      state.servicesError = null;
      state.selectedServiceId = 0; // Also clear selected service
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
        state.servicesError = action.error.message || 'Failed to load services';
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
} = serviceSlice.actions;

export default serviceSlice.reducer;
