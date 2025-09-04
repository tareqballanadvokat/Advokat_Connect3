// src/store/slices/emailSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TransferAttachmentItem } from '../../taskpane/components/interfaces/IDocument';

// Define the state structure for email-specific functionality
interface EmailState {
  // Attachments (email-specific state)
  attachmentSelected: TransferAttachmentItem[];
}

// Initial state
const initialState: EmailState = {
  attachmentSelected: [],
};

// Create the email slice
const emailSlice = createSlice({
  name: 'email',
  initialState,
  reducers: {
    // Attachment actions
    setAttachmentSelected: (state, action: PayloadAction<TransferAttachmentItem[]>) => {
      state.attachmentSelected = action.payload;
    },
  },
});

// Export actions and reducer
export const { 
  setAttachmentSelected,
} = emailSlice.actions;

export default emailSlice.reducer;
