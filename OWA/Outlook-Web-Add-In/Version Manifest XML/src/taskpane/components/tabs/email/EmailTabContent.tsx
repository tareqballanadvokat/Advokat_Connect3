// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useEffect, useState } from 'react';
import SearchCaseList from '@components/tabs/shared/SearchCaseList';
import notify from 'devextreme/ui/notify';
import EmailSend from './EmailSend'; 
import RegisteredEmails from './RegisteredEmails';  
// Import Service Section from shared
import ServiceSection from '@components/tabs/shared/ServiceSection';
import { getEmailContentAsync, IsComposeMode, getInternetMessageIdAsync } from '@hooks/useOfficeItem';
import TransferAndAttachment from './TransferAndAttachment';
import { TransferAttachmentItem, DokumentPostData, DokumentArt, DokumentResponse } from '@interfaces/IDocument';
import { getDokumentArt } from '@interfaces/IEmail';
import { AktLookUpResponse } from '@interfaces/IAkten';
import { LeistungPostData } from '@interfaces/IService';
import WebRTCConnectionStatus from '@components/tabs/shared/WebRTCConnectionStatus';
import { calculateFileSizeFromBase64 } from '@utils/fileHelpers';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();

// Import Redux hooks and actions
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setSelectedAkt, clearFolders, clearEmailDocuments } from '@slices/aktenSlice';
import { saveDokumentAsync, setAttachmentSelected } from '@slices/emailSlice';
import { saveLeistungAsync, resetLoadCounter } from '@slices/serviceSlice';

const EmailTabContent: React.FC = () => {
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  const { t: translate } = useTranslation(['email', 'common']);
  
  // Get cases from aktenSlice to find selected case data
  const { cases } = useAppSelector(state => state.akten);
  
  // Local state for transfer loading
  const [transferLoading, setTransferLoading] = useState(false);
  
  // Get Redux state from akten and email slices
  const { selectedAkt } = useAppSelector(state => state.akten);
  const { attachmentSelected } = useAppSelector(state => state.email);
  
  // Derive case values from selectedAkt
  const selectedCaseId = selectedAkt?.id ?? -1;
  const selectedCaseName = selectedAkt?.aKurz ?? '';
  
  // Get service state
  const { selectedServiceId, time, text, sb, services } = useAppSelector(state => state.service);
  
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
        logger.error('Failed to get message ID:', 'EmailTabContent', e);
      }
    })();
  }, []);

  // No longer need to update transfer button state as it's derived from selectedAkt
  // useEffect removed

  // Helper function to get folder name from attachment item
  const getFolderName = (item: TransferAttachmentItem): string | null => {
    return item.folderName || null;
  };

  const setCaseHandler = async (selectedCase: AktLookUpResponse) => {
    const isNewAkt = selectedAkt?.id !== selectedCase.id;
    
    // Set the selected case object directly in aktenSlice
    dispatch(setSelectedAkt(selectedCase));
    
    if (isNewAkt) {
      // Different Akt: Reset service load counter to start fresh (cache first)
      dispatch(resetLoadCounter());
    } else {
      // Same Akt clicked again: Clear tracking to force reload of folders and documents
      dispatch(clearFolders());
      dispatch(clearEmailDocuments());
      dispatch(resetLoadCounter());
    }
  }
  
  // Helper function to convert HH:MM to minutes
  const convertTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [hours, minutes] = timeStr.split(':').map(s => parseInt(s) || 0);
    return hours * 60 + minutes;
  };
  
  // Handler for sending email
  const sendEmailHandler = async () => {
    if (selectedCaseId === -1) {
      notify(translate('common:selectCaseFirst'), 'warning', 3000);
      return;
    }
    logger.debug(`Starting transfer for case ${selectedCaseName} (ID: ${selectedCaseId}) with message ID: ${messageId}`, 'EmailTabContent');
    if (!messageId) {
      notify(translate('emailMessageIdNotAvailable'), 'warning', 3000);
      return;
    }

    // Set loading state
    setTransferLoading(true);

    try {
      // STEP 1: Save Leistung first (if service is selected)
      if (selectedServiceId && selectedServiceId > 0) {
        // Validate that either SB or time is provided (or both are empty)
        const hasSb = sb && sb.trim() !== '';
        const hasTime = time && time.trim() !== '';
        
        // If one is provided, both must be provided
        if ((hasSb && !hasTime) || (!hasSb && hasTime)) {
          notify(translate('provideBothSbAndTime'), 'error', 4000);
          setTransferLoading(false);
          return;
        }
        
        logger.debug('Saving Leistung via WebRTC...', 'EmailTabContent');
        
        // Find the selected service to get its kürzel
        const selectedService = services.find(service => service.id === selectedServiceId);
        const serviceKuerzel = selectedService?.kürzel || selectedServiceId.toString();
        
        // Create payload using LeistungPostData interface matching C# model
        const timeInMinutes = convertTimeToMinutes(time);
        
        // Build sachbearbeiter array with SB and time information
        const sachbearbeiter = [];
        if (sb && sb.trim() !== '' && timeInMinutes !== null) {
          sachbearbeiter.push({
            sb: sb.trim(),
            zeitVerrechenbarInMinuten: timeInMinutes,
            zeitNichtVerrechenbarInMinuten: 0
          });
        }
        
        const leistungPayload: LeistungPostData = {
          aktId: selectedCaseId !== -1 ? selectedCaseId : null,
          aKurz: selectedCaseName || null,
          leistungKurz: serviceKuerzel,
          datum: new Date().toISOString(), // Current date in ISO format
          honorartext: text || null,
          memo: text || null,
          outlookEmailId: messageId || undefined, // Link leistung to email for retrieval
          sachbearbeiter: sachbearbeiter.length > 0 ? sachbearbeiter : undefined
        };
        
        // Send Leistung to API via WebRTC using Redux thunk
        await dispatch(saveLeistungAsync(leistungPayload)).unwrap();
        logger.info('Leistung saved successfully', 'EmailTabContent');
        notify(translate('serviceSavedSuccessfully'), 'success', 3000);
      } else {
        logger.debug('No service selected, skipping Leistung save', 'EmailTabContent');
      }

      // STEP 2: Handle Email and Attachments via WebRTC API
      logger.debug('Processing email and attachments...', 'EmailTabContent');
      
      const email = Office.context.mailbox.item;
      
      // Find selected email (exclude already-transferred/disabled items)
      const firstE = attachmentSelected.find(i => i.checked && i.type === 'E' && !i.disabled); // email taken
      let emailContent = '';
      
      // Save email as document if selected
      if (firstE != null) {
        emailContent = await getEmailContentAsync(email);
        logger.debug('Email content extracted for transfer', 'EmailTabContent');
        
        // Detect the correct document type (sent vs received email)
        const isCompose = IsComposeMode();
        const emailDokumentArt = await getDokumentArt(true, isCompose, email?.from?.emailAddress);
        
        // Create DokumentPostData for email
        const emailDokument: DokumentPostData = {
          aktId: selectedCaseId,
          betreff: email?.subject || translate('noSubject'),
          mailAdresse: email?.from?.emailAddress || undefined,
          empfangenAm: email?.dateTimeCreated ? new Date(email.dateTimeCreated) : new Date(),
          memo: `Email transferred from Outlook: ${messageId}`,
          inhalt: emailContent,
          dokumentArt: emailDokumentArt, // Properly detected: sent vs received
          outlookEmailId: messageId,
          anzahlMailAnhänge: attachmentSelected.filter(i => i.type === 'A').length,
          dateiName: `${email?.subject || translate('noEmailName')}.eml`,
          ordnerName: getFolderName(firstE)
        };
        
        // Save email document via WebRTC using Redux thunk
        const savedEmailResponse = await dispatch(saveDokumentAsync(emailDokument)).unwrap();
        logger.info('Email document saved successfully', 'EmailTabContent');
        notify(translate('emailSavedSuccessfully'), 'success', 3000);
        console.log('Saved email document response:', savedEmailResponse);
        // Build a partial DokumentResponse so RegisteredEmails can update its cache immediately
        // Use the real ID returned by CreateAsync so the user can download immediately
        const returnedId = savedEmailResponse?.body ? parseInt(savedEmailResponse.body, 10) : NaN;
        const now = new Date();
        const optimisticEntry: DokumentResponse = {
          id: !isNaN(returnedId) ? returnedId : -Date.now(), // Real server ID when available
          betreff: emailDokument.betreff,
          dokumentArt: emailDokument.dokumentArt,
          mailAdresse: emailDokument.mailAdresse,
          datum: emailDokument.empfangenAm ?? now,
          bearbeitungsInfoErstelltAm: now,
          anzahlMailAnhänge: emailDokument.anzahlMailAnhänge,
          outlookEmailId: emailDokument.outlookEmailId,
        };
      }
      else {
        logger.debug('No email selected, skipping Email save', 'EmailTabContent');
      }

      // Get selected attachments and save each as a document
      const selectedAttachments = attachmentSelected.filter(i => i.checked && i.type === 'A' && !i.disabled);
      
      if (selectedAttachments.length > 0) {
        logger.debug(`Processing ${selectedAttachments.length} attachments for transfer`, 'EmailTabContent');
        
        for (const attachment of selectedAttachments) {
          try {
            // Get attachment content
            const contentBase64 = await new Promise<string>((resolve, reject) => {
              Office.context.mailbox.item?.getAttachmentContentAsync(attachment.id, ar => {
                if (ar.status === Office.AsyncResultStatus.Succeeded) {
                  resolve(ar.value.content);
                } else {
                  reject(new Error(ar.error?.message || 'Failed to get attachment content'));
                }
              });
            });
            
            // Create DokumentPostData for attachment
            const attachmentDokument: DokumentPostData = {
              aktId: selectedCaseId,
              betreff: attachment.name,
              mailAdresse: email?.from?.emailAddress || undefined,
              empfangenAm: email?.dateTimeCreated ? new Date(email?.dateTimeCreated) : new Date(),
              memo: `Attachment from email: ${messageId}`,
              inhalt: contentBase64, // Store the base64 content
              dokumentArt: DokumentArt.Keine, // Normal attachment
              outlookEmailId: messageId,
              anzahlMailAnhänge: 0, // This is an attachment, not an email with attachments
              dateiName: attachment.name,
              ordnerName: getFolderName(attachment),
            };
            
            // Save attachment document via WebRTC using Redux thunk
            await dispatch(saveDokumentAsync(attachmentDokument)).unwrap();
            logger.info(`Attachment '${attachment.name}' saved successfully`, 'EmailTabContent');
          } catch (attachmentError) {
            logger.error(`Failed to save attachment '${attachment.name}':`, 'EmailTabContent', attachmentError);
            notify(translate('failedToSaveAttachment', { name: attachment.name }), 'warning', 4000);
            // Continue with other attachments
          }
        }
        
        if (selectedAttachments.length > 0) {
          notify(translate('attachmentsProcessed', { count: selectedAttachments.length }), 'success', 3000);
        }
      }

      // Show success notification if any documents were saved
      if (firstE || selectedAttachments.length > 0) {
        const itemCount = (firstE ? 1 : 0) + selectedAttachments.length;
        notify(translate('documentsTransferred', { count: itemCount, caseName: selectedCaseName }), 'success', 4000);
      }

      // Mark all successfully transferred items as disabled/readonly in Redux
      // so the UI deactivates their checkboxes and folder selectors immediately
      const transferredIds = new Set<string>();
      if (firstE) transferredIds.add(firstE.id);
      selectedAttachments.forEach(a => transferredIds.add(a.id));

      if (transferredIds.size > 0) {
        dispatch(setAttachmentSelected(
          attachmentSelected.map(i =>
            transferredIds.has(i.id) ? { ...i, disabled: true, readonly: true, checked: true } : i
          )
        ));
        // Force TransferAndAttachment to re-fetch documents on next render so that
        // when the user navigates away and back the saved items are still shown as disabled.
        dispatch(clearEmailDocuments());
      }

    } catch (error) {
      logger.error('Failed to transfer:', 'EmailTabContent', error);
      notify(translate('failedToTransfer'), 'error', 5000);
    } finally {
      // Reset loading state
      setTransferLoading(false);
    }
  };
 
 

  // We no longer need these callback functions as we're using the Redux-based ServiceSection
  // which handles its own Redux dispatching

  const isCompose = IsComposeMode();

  return (
    <div>
      {/* WebRTC Connection Status */}
      <WebRTCConnectionStatus />

      {/* 1) Search panel + case list */}
      <SearchCaseList onCaseSelect={setCaseHandler} />
 
      {/* <DropAttachArea /> */}
 
      {/* 3) Services section - hidden in compose mode */}
      {!isCompose && (
        <EmailSend
          caseId={selectedCaseName}
          onTransfer={sendEmailHandler}
          transferBtnDisable={!selectedAkt || !attachmentSelected.some(i => i.checked && !i.disabled)}
          transferLoading={transferLoading}
        />
      )}

      {/* Service Section - hidden in compose mode */}
      {!isCompose && <ServiceSection />}
 
      {/* 4) Transfer e-mail and attachments - hidden in compose mode */}
      {!isCompose && <TransferAndAttachment />}
   
      {/* 5) Registered E-Mails */}
      <RegisteredEmails />
    </div>
  );
};

export default EmailTabContent;
