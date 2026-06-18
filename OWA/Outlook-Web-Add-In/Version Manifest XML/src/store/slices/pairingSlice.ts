// src/store/slices/pairingSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Pairing status of this Add-in instance with an ADVOKAT Server.
 *
 * - 'unknown'   : Not yet checked (initial state / Office token not yet obtained)
 * - 'checking'  : Pairing API call in progress
 * - 'paired'    : oid ↔ advokatServerId mapping exists on the Pairing API
 * - 'unpaired'  : No mapping found (first-time setup — OTP flow required)
 * - 'error'     : Pairing API call failed (network error or unexpected status)
 */
export type PairingStatus = 'unknown' | 'checking' | 'paired' | 'unpaired' | 'error';

export interface PairingState {
  status: PairingStatus;
  advokatServerId: string | null;
  error: string | null;
}

const initialState: PairingState = {
  status: 'unknown',
  advokatServerId: null,
  error: null,
};

const pairingSlice = createSlice({
  name: 'pairing',
  initialState,
  reducers: {
    setPairingChecking: (state) => {
      state.status = 'checking';
      state.error = null;
    },

    setPaired: (state, action: PayloadAction<string>) => {
      state.status = 'paired';
      state.advokatServerId = action.payload;
      state.error = null;
    },

    setUnpaired: (state) => {
      state.status = 'unpaired';
      state.advokatServerId = null;
      state.error = null;
    },

    setPairingError: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },

    resetPairing: () => initialState,
  },
});

export const {
  setPairingChecking,
  setPaired,
  setUnpaired,
  setPairingError,
  resetPairing,
} = pairingSlice.actions;

// Selectors
export const selectPairing = (state: { pairing: PairingState }) => state.pairing;
export const selectPairingStatus = (state: { pairing: PairingState }) => state.pairing.status;
export const selectAdvokatServerId = (state: { pairing: PairingState }) => state.pairing.advokatServerId;

export default pairingSlice.reducer;
