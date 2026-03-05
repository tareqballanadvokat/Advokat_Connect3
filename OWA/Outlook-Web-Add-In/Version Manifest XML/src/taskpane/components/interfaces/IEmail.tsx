// Email-related interfaces and models
import { DokumentArt, TransferAttachmentItem } from './IDocument';
import { getLogger } from '@services/logger';

const logger = getLogger();

export interface EmailSendProps {
  caseId: string;
  onTransfer: () => void;
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
  attachments: TransferAttachmentItem[] | [];
}

/**
 * Get the current user's email address from Office context
 * @returns Promise with the current user's email address
 */
export function getCurrentUserEmail(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (Office.context.mailbox?.userProfile?.emailAddress) {
      resolve(Office.context.mailbox.userProfile.emailAddress);
    } else {
      reject(new Error('Unable to get current user email address'));
    }
  });
}

/**
 * Determine the correct DokumentArt based on email context
 * @param isEmail - Whether this is an email document
 * @param isCompose - Whether we're in compose mode (sending email)
 * @param emailFrom - The email address of the sender (from email.from?.emailAddress)
 * @returns Promise with the appropriate DokumentArt value
 */
export async function getDokumentArt(
  isEmail: boolean, 
  isCompose: boolean = false, 
  emailFrom?: string
): Promise<DokumentArt> {
  if (!isEmail) {
    return DokumentArt.Keine; // Normal attachment
  }
  
  // If we're in compose mode, it's definitely a sent email
  if (isCompose) {
    return DokumentArt.MailGesendet;
  }
  
  // If we have the sender email, try to get current user email for comparison
  if (emailFrom) {
    try {
      const currentUserEmail = await getCurrentUserEmail();
      return emailFrom.toLowerCase() === currentUserEmail.toLowerCase() 
        ? DokumentArt.MailGesendet 
        : DokumentArt.MailEmpfangen;
    } catch (error) {
      logger.warn('Could not get current user email for DokumentArt detection', 'IEmail', error);
    }
  }
  
  // Default to received email if we can't determine otherwise
  return DokumentArt.MailEmpfangen;
}