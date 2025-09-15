// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useEffect, useState } from 'react';
import SearchCaseList from './SearchCaseList'; 
import notify from 'devextreme/ui/notify';
import EmailSend from './EmailSend'; 
import RegisteredEmails from './RegisteredEmails';  
// Import Service Section from shared
import ServiceSection from '../shared/ServiceSection';
import { getEmailAttachmentData, getEmailContentAsync, IsComposeMode } from '@hooks/useOfficeItem';
import TransferAndAttachment from './TransferAndAttachment';
import { TransferAttachmentItem, DokumentPostData, DokumentArt } from '@components/interfaces/IDocument';
import { getDokumentArt } from '@components/interfaces/IEmail';
import { LeistungPostData } from '@components/interfaces/IService';
import { webRTCApiService } from '../../../services/webRTCApiService';
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus';

import { getInternetMessageIdAsync } from '@hooks/useOfficeItem';

// Import Redux hooks and actions
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setSelectedAkt } from '@store/slices/aktenSlice';

const EmailTabContent: React.FC = () => {
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  
  // Get cases from aktenSlice to find selected case data
  const { cases } = useAppSelector(state => state.akten);
  
  // Local state for transfer loading
  const [transferLoading, setTransferLoading] = useState(false);
  
  // Get Redux state from akten and email slices
  const { selectedAkt } = useAppSelector(state => state.akten);
  const { attachmentSelected } = useAppSelector(state => state.email);
  
  // Derive case values from selectedAkt
  const selectedCaseId = selectedAkt?.Id ?? -1;
  const selectedCaseName = selectedAkt?.aKurz ?? '';
  
  // Get service state
  const { abbreviation, time, text, sb } = useAppSelector(state => state.service);
  
  // Get email message ID
  const [messageId, setMessageId] = useState<string | null>(null);

  // Initialize component with email data
  useEffect(() => {
    (async () => {
      try {
        // Get email message ID
        const email = Office.context.mailbox.item;
        const msgId = await getInternetMessageIdAsync(email);
        setMessageId(msgId);
      } catch (e: any) {
        console.error(e);
      }
    })();
  }, []);

  // No longer need to update transfer button state as it's derived from selectedAkt
  // useEffect removed

  // Helper function to get folder name from attachment item
  const getFolderName = (item: TransferAttachmentItem): string => {
    return item.folderName || 'Default';
  };

  // Handler for case selection
  const setCaseHandler = async (id: string) => {
    // Find the selected case from the cases array and set it in aktenSlice
    const selectedCase = cases.find(c => c.Id === Number.parseInt(id));
    dispatch(setSelectedAkt(selectedCase || null));
  }
  
  // Handler for sending email
  const sendEmailHandler = async () => {
    if (selectedCaseId === -1) {
      notify('Please select a case first', 'warning', 3000);
      return;
    }

    if (!messageId) {
      notify('Email message ID not available', 'warning', 3000);
      return;
    }

    // Set loading state
    setTransferLoading(true);

    try {
      // STEP 1: Save Leistung first (if service is selected)
      if (abbreviation && abbreviation > 0) {
        console.log('📤 Saving Leistung via WebRTC...');
        
        // Create payload using LeistungPostData interface matching C# model
        const leistungPayload: LeistungPostData = {
          AktId: selectedCaseId,
          AKurz: selectedCaseName,
          LeistungKurz: abbreviation.toString(),
          Datum: new Date().toISOString(), // Current date in ISO format
          Honorartext: text || undefined,
          Memo: text || undefined,
          SBZeitVerrechenbarInMinuten: time ? parseInt(time) : undefined,
          SBZeitNichtVerrechenbarInMinuten: undefined
        };
        
        // Check if WebRTC connection is ready
        if (!webRTCApiService.isReady()) {
          notify('WebRTC connection not available. Please ensure connection is established.', 'warning', 5000);
          return;
        }
        
        // Send Leistung to API via WebRTC
        const leistungResponse = await webRTCApiService.saveLeistung(leistungPayload);
        
        if (leistungResponse.response.statusCode >= 200 && leistungResponse.response.statusCode < 300) {
          console.log('✅ Leistung saved successfully');
          notify('Service saved successfully', 'success', 3000);
        } else {
          throw new Error('Failed to save service');
        }
      } else {
        console.log('⚠️ No service selected, skipping Leistung save');
      }

      // STEP 2: Handle Email and Attachments via WebRTC API
      console.log('📧 Processing email and attachments...');
      
      const email = Office.context.mailbox.item;
      
      // Find selected email
      const firstE = attachmentSelected.find(i => i.checked && i.type === 'E'); // email taken
      let emailContent = '';
      
      // Save email as document if selected
      if (firstE != null) {
        emailContent = await getEmailContentAsync(email);
        console.log('📄 Email content extracted for transfer');
        
        // Detect the correct document type (sent vs received email)
        const isCompose = IsComposeMode();
        const emailDokumentArt = await getDokumentArt(true, isCompose, email.from?.emailAddress);
        
        // Create DokumentPostData for email
        const emailDokument: DokumentPostData = {
          aktId: selectedCaseId,
          betreff: email.subject || 'No Subject',
          mailAdresse: email.from?.emailAddress || undefined,
          empfangenAm: email.dateTimeCreated ? new Date(email.dateTimeCreated) : new Date(),
          memo: `Email transferred from Outlook: ${messageId}`,
          inhalt: emailContent,
          dokumentArt: emailDokumentArt, // Properly detected: sent vs received
          outlookId: messageId,
          anzahlMailAnhänge: attachmentSelected.filter(i => i.type === 'A').length,
          dateiName: `${email.subject || 'Email'}.eml`,
          ordnerName: getFolderName(firstE)
        };
        
        // Save email document via WebRTC
        const emailResponse = await webRTCApiService.saveDokument(emailDokument);
        
        if (emailResponse.response.statusCode >= 200 && emailResponse.response.statusCode < 300) {
          console.log('✅ Email document saved successfully');
          notify('Email saved successfully', 'success', 3000);
        } else {
          throw new Error(emailResponse.response.body || 'Failed to save email document');
        }
      }

      // Get selected attachments and save each as a document
      const selectedAttachments = attachmentSelected.filter(i => i.checked && i.type === 'A');
      
      if (selectedAttachments.length > 0) {
        console.log(`� Processing ${selectedAttachments.length} attachments for transfer`);
        
        for (const attachment of selectedAttachments) {
          try {
            // Get attachment content
            const contentBase64 = await new Promise<string>((resolve, reject) => {
              Office.context.mailbox.item.getAttachmentContentAsync(attachment.id, ar => {
                if (ar.status === Office.AsyncResultStatus.Succeeded) {
                  resolve(ar.value.content);
                } else {
                  reject(new Error(ar.error?.message || 'Failed to get attachment content'));
                }
              });
            });
            
            // Calculate file size from base64 (approximate)
            const fileSizeInBytes = Math.round((contentBase64.length * 3) / 4);
            
            // Create DokumentPostData for attachment
            const attachmentDokument: DokumentPostData = {
              aktId: selectedCaseId,
              betreff: `Attachment: ${attachment.name}`,
              mailAdresse: email.from?.emailAddress || undefined,
              empfangenAm: email.dateTimeCreated ? new Date(email.dateTimeCreated) : new Date(),
              memo: `Attachment from email: ${messageId}`,
              inhalt: contentBase64, // Store the base64 content
              dokumentArt: DokumentArt.Keine, // Normal attachment
              outlookId: messageId,
              anzahlMailAnhänge: 0, // This is an attachment, not an email with attachments
              dateiName: attachment.name,
              ordnerName: getFolderName(attachment)
            };
            
            // Save attachment document via WebRTC
            const attachmentResponse = await webRTCApiService.saveDokument(attachmentDokument);
            
            if (attachmentResponse.response.statusCode >= 200 && attachmentResponse.response.statusCode < 300) {
              console.log(`✅ Attachment '${attachment.name}' saved successfully`);
            } else {
              throw new Error(attachmentResponse.response.body || `Failed to save attachment '${attachment.name}'`);
            }
          } catch (attachmentError) {
            console.error(`Failed to save attachment '${attachment.name}':`, attachmentError);
            notify(`Failed to save attachment '${attachment.name}'`, 'warning', 4000);
            // Continue with other attachments
          }
        }
        
        if (selectedAttachments.length > 0) {
          notify(`${selectedAttachments.length} attachments processed`, 'success', 3000);
        }
      }

      // Show success notification if any documents were saved
      if (firstE || selectedAttachments.length > 0) {
        const itemCount = (firstE ? 1 : 0) + selectedAttachments.length;
        notify(`${itemCount} document(s) transferred successfully to case ${selectedCaseName}`, 'success', 4000);
      }

    } catch (error) {
      console.error('Failed to transfer:', error);
      notify('Failed to transfer to ADVOKAT', 'error', 5000);
    } finally {
      // Reset loading state
      setTransferLoading(false);
    }
  };
 
 

  // We no longer need these callback functions as we're using the Redux-based ServiceSection
  // which handles its own Redux dispatching
  
  const handleCaseChange = (value: string) => {
    // Update the selected Akt name (aKurz) in the current selectedAkt
    if (selectedAkt) {
      dispatch(setSelectedAkt({ ...selectedAkt, aKurz: value }));
    }
  };

  return (
    <div>
      {/* WebRTC Connection Status */}
      <WebRTCConnectionStatus />

      {/* 1) Search panel + case list */}
      <SearchCaseList onCaseSelect={setCaseHandler} />
 
      {/* <DropAttachArea /> */}
 
      {/* 3) Services section */}
      <EmailSend
        caseId={selectedCaseName}
        onCaseChange={handleCaseChange}
        onTransfer={sendEmailHandler}
        caseIdDisable={!selectedAkt}
        transferBtnDisable={!selectedAkt || attachmentSelected.length === 0}
        transferLoading={transferLoading}
      />

      {/* Use the shared ServiceSection component in email mode */}
      <ServiceSection selectedAktKuerzel={selectedCaseName} mode="email" />
 
      {/* 4) Transfer e-mail and attachments */}
      <TransferAndAttachment />
   
      {/* 5) Registered E-Mails */}
      <RegisteredEmails />
    </div>
  );
};

export default EmailTabContent;
