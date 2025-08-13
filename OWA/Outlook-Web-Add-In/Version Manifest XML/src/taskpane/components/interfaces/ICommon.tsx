// Common interfaces and models shared across different components

// Abbreviation model for select options
export interface Abbreviation {
  id: number;
  name: string;
}

// Generic transfer data structure
export interface TransferData {
  emailRow: any; // TransferEmailItem from TransferAndAttachment
  attachmentRows: any[]; // TransferAttachmentItem[] from TransferAndAttachment
}

// API response wrapper (if needed)
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
