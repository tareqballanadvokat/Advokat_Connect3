// src/store/slices/emailSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TransferAttachmentItem } from '../../taskpane/components/interfaces/IDocument';

interface EmailState {
  attachmentSelected: TransferAttachmentItem[];
}

const initialState: EmailState = {
  attachmentSelected: [],
};

const emailSlice = createSlice({
  name: 'email',
  initialState,
  reducers: {
    setAttachmentSelected: (state, action: PayloadAction<TransferAttachmentItem[]>) => {
      state.attachmentSelected = action.payload;
    },
  },
});

export const { 
  setAttachmentSelected,
} = emailSlice.actions;

export default emailSlice.reducer;
