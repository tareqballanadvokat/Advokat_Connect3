// Email-related interfaces and models

export interface EmailSendProps {
  caseId: string;
  onCaseChange: (id: string) => void;
  onTransfer: () => void;
  caseIdDisable: boolean;
  transferBtnDisable: boolean;
  transferLoading?: boolean;  // New prop for loading state
}

export interface CaseSendProps {
  caseId: string;
  onCaseChange: (id: string) => void;
  onTransfer: () => void;
}

export interface RegisteredEmail {
  id: string;
  date: string;
  subject: string;
}

// Email data model for API communication
export interface EmailModel {
  caseId: number;
  caseName: string;
  serviceAbbreviationType: string;
  serviceSB: string;
  serviceTime: string;
  serviceText: string;
  internetMessageId: string;
  emailName: string;
  emailContent: string;
  emailFolder: string;
  emailFolderId: number;
  userID: string;
  attachments: Attachment[] | [];
}

// Attachment model
export interface Attachment {
  id: string;
  originalFileName: string;
  fileName: string;
  contentBase64: string;
  folder: number;
}