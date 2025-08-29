// src/store/slices/emailSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TransferAttachmentItem } from '../../taskpane/components/interfaces/IDocument';

// Define the state structure for email-related functionality
interface EmailState {
  // Case information
  selectedCaseId: number;
  selectedCaseName: string;
  selectedCaseDisable: boolean;
  transferCaseDisable: boolean;
  
  // Attachments
  attachmentSelected: TransferAttachmentItem[];
}

// Initial state
const initialState: EmailState = {
  selectedCaseId: -1,
  selectedCaseName: '',
  selectedCaseDisable: false,
  transferCaseDisable: true,
  
  attachmentSelected: [],
};

// Create the email slice
const emailSlice = createSlice({
  name: 'email',
  initialState,
  reducers: {
    // Case selection actions
    setSelectedCase: (state, action: PayloadAction<{ id: number, name: string }>) => {
      state.selectedCaseId = action.payload.id;
      state.selectedCaseName = action.payload.name;
    },
    setSelectedCaseDisable: (state, action: PayloadAction<boolean>) => {
      state.selectedCaseDisable = action.payload;
    },
    
    // Attachment actions
    setAttachmentSelected: (state, action: PayloadAction<TransferAttachmentItem[]>) => {
      state.attachmentSelected = action.payload;
    },
    
    // Update transfer case button state based on service data in the root state
    updateTransferCaseDisableState: (state) => {
      // Get service state via selector in components instead of here
      state.transferCaseDisable = state.selectedCaseId === -1;
    },
  },
});

// Export actions and reducer
export const { 
  setSelectedCase,
  setSelectedCaseDisable,
  setAttachmentSelected,
  updateTransferCaseDisableState,
} = emailSlice.actions;

export default emailSlice.reducer;
