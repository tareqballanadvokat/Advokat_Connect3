export interface EmailSendProps {
  caseId: string;
  onCaseChange: (id: string) => void;
  onTransfer: () => void;
  caseIdDisable: boolean;
  transferBtnDisable:boolean;
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