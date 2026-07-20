// src/store/slices/emailSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import {
  TransferAttachmentItem,
  DokumentPostData,
} from "@interfaces/IDocument";
import { getWebRTCConnectionManager } from "@services/WebRTCConnectionManager";

interface EmailState {
  attachmentSelected: TransferAttachmentItem[];
  saveDokumentLoading: boolean;
  saveDokumentError: string | null;
  saveCount: number; // increments on every successful save — used to trigger re-fetch in RegisteredEmails
  registeredEmailsLoading: boolean;
}

const initialState: EmailState = {
  attachmentSelected: [],
  saveDokumentLoading: false,
  saveDokumentError: null,
  saveCount: 0,
  registeredEmailsLoading: false,
};

// Async thunk for saving document via WebRTC
export const saveDokumentAsync = createAsyncThunk(
  "email/saveDokument",
  async (dokumentData: DokumentPostData) => {
    const connectionManager = getWebRTCConnectionManager();
    const webRTCApiService = connectionManager.getWebRTCApiService();
    const response = await webRTCApiService.saveDokument(dokumentData);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response;
    } else {
      throw new Error(response.body || "Failed to save document");
    }
  }
);

const emailSlice = createSlice({
  name: "email",
  initialState,
  reducers: {
    setAttachmentSelected: (state, action: PayloadAction<TransferAttachmentItem[]>) => {
      state.attachmentSelected = action.payload;
    },
    clearSaveDokumentError: (state) => {
      state.saveDokumentError = null;
    },
    setRegisteredEmailsLoading: (state, action: PayloadAction<boolean>) => {
      state.registeredEmailsLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(saveDokumentAsync.pending, (state) => {
        state.saveDokumentLoading = true;
        state.saveDokumentError = null;
      })
      .addCase(saveDokumentAsync.fulfilled, (state) => {
        state.saveDokumentLoading = false;
        state.saveDokumentError = null;
        state.saveCount += 1;
      })
      .addCase(saveDokumentAsync.rejected, (state, action) => {
        state.saveDokumentLoading = false;
        state.saveDokumentError = action.error.message || "Failed to save document";
      });
  },
});

export const { setAttachmentSelected, clearSaveDokumentError, setRegisteredEmailsLoading } = emailSlice.actions;

export default emailSlice.reducer;
