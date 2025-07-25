// src/store/slices/serviceSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { abbreviationApi } from '../services/abbreviationApi';

// Define the state structure for service-related functionality
interface ServiceState {
  // Service section data
  abbreviation: number;
  time: string;
  text: string;
  sb: string;
}

// Initial state
const initialState: ServiceState = {
  abbreviation: 0,
  time: '',
  text: '',
  sb: '',
};

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
} = serviceSlice.actions;

export default serviceSlice.reducer;
