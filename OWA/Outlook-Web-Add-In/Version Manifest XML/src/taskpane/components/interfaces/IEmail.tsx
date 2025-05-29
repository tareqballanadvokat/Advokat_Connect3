export interface EmailSendProps {
  caseId: string;
  onCaseChange: (id: string) => void;
  onTransfer: () => void;
  // sb:string;
  // abbreviation:number;
  // text: string;
  // time: string;
  caseIdDisable: boolean;
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