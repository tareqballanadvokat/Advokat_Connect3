// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useEffect } from 'react';
import SearchCaseList from './SearchCaseList'; 
import notify from 'devextreme/ui/notify';
import EmailSend from './EmailSend'; 
import RegisteredEmails from './RegisteredEmails';  
// Import Service Section from shared
import ServiceSection from '../shared/ServiceSection';
import { getEmailAttachmentData, getEmailContentAsync } from '@hooks/useOfficeItem';
import TransferAndAttachment, { TransferAttachmentItem } from './TransferAndAttachment';
import { Attachment, EmailModel } from '@components/interfaces/IEmail';
import { LeistungPostData } from '@components/interfaces/IService';
import { webRTCApiService } from '../../../services/webRTCApiService';
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus';

import { getInternetMessageIdAsync } from '@hooks/useOfficeItem'; 
import DropAttachArea from '../shared/DropAttachArea';

// Import Redux hooks and actions
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { 
  setSelectedCase,
  setAttachmentSelected,
  updateTransferCaseDisableState
} from '@store/slices/emailSlice';
import { setServiceData } from '@store/slices/serviceSlice';
import { useGetSavedEmailQuery, useSaveEmailInfoMutation } from '@store/services/emailApi';

// Helper function to map attachments
async function mapToAttachments(
  items: TransferAttachmentItem[]
): Promise<Attachment[]> {
  const selected = items.filter(i => i.checked);

  // Get base64 content of each attachment
  const results = await Promise.all(selected.map(async i => {
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      Office.context.mailbox.item.getAttachmentContentAsync(i.id, ar => {
        if (ar.status === Office.AsyncResultStatus.Succeeded) {
          resolve(ar.value.content); // base64
        } else {
          resolve(''); // or reject(ar.error.message)
          reject('');
        }
      });
    });
    return {
      id: i.id,
      originalFileName: i.name,
      fileName: i.label,
      contentBase64,
      folder: i.option
    } as Attachment;
  }));
  return results;
}

const EmailTabContent: React.FC = () => {
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  
  // Local state for transfer loading
  const [transferLoading, setTransferLoading] = React.useState(false);
  
  // Get Redux state from both email and service slices
  const {
    selectedCaseName,
    selectedCaseId,
    selectedCaseDisable,
    transferCaseDisable,
    attachmentSelected
  } = useAppSelector(state => state.email);
  
  // Get service state
  const { abbreviation, time, text, sb } = useAppSelector(state => state.service);
  
  // RTK Query hooks
  const [saveEmailInfo] = useSaveEmailInfoMutation();
  
  // Get email message ID
  const [messageId, setMessageId] = React.useState<string | null>(null);
  
  // Use RTK Query to fetch saved email
  const { data: savedEmail } = useGetSavedEmailQuery(messageId || '', {
    // Skip the query if messageId is not available yet
    skip: !messageId
  });

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

  // Update transfer button state when related fields change
  useEffect(() => {
    dispatch(updateTransferCaseDisableState());
  }, [dispatch]);

  // Handler for case selection
  const setCaseHandler = async (id: string, name: string) => {
    console.log(id, name);
    dispatch(setSelectedCase({
      id: Number.parseInt(id),
      name: name
    }));
  }
  
  // Handler for sending email
  const sendEmailHandler = async () => {
    console.log('Transfer to ADVOKAT, caseId =', selectedCaseName);
    console.log(sb, text, abbreviation, time);

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
        
        if (leistungResponse.statusCode >= 200 && leistungResponse.statusCode < 300) {
          console.log('✅ Leistung saved successfully');
          notify('Service saved successfully', 'success', 3000);
        } else {
          throw new Error(leistungResponse.error || 'Failed to save service');
        }
      } else {
        console.log('⚠️ No service selected, skipping Leistung save');
      }

      // STEP 2: Handle Email and Attachments
      // TODO: Implement email content transfer via WebRTC API
      // TODO: Implement attachment transfer via WebRTC API
      
      console.log('📧 Processing email and attachments...');
      
      const email = Office.context.mailbox.item;
      
      // Find selected email
      const firstE = attachmentSelected.find(i => i.checked && i.type === 'E'); // email taken
      let emailContent = '';
      if (firstE != null) {
        emailContent = await getEmailContentAsync(email);
        console.log('📄 Email content extracted for transfer');
        // TODO: Send email content via WebRTC API to save email to case
      }

      // Get selected attachments
      const attachmentsPayload = await mapToAttachments(
        attachmentSelected.filter(i => i.checked && i.type === 'A')
      );
      
      if (attachmentsPayload.length > 0) {
        console.log(`📎 ${attachmentsPayload.length} attachments processed for transfer`);
        // TODO: Send attachments via WebRTC API to save documents to case
      }

      // TEMPORARY: Use existing RTK Query for now (remove when WebRTC email/attachment API is ready)
      if (firstE || attachmentsPayload.length > 0) {
        console.log('💾 Saving email/attachments via existing API (temporary)...');
        
        // Create payload
        const payload: EmailModel = firstE
          ? {
              caseId: selectedCaseId,
              caseName: selectedCaseName,
              serviceAbbreviationType: abbreviation.toString(),
              serviceSB: sb,
              serviceTime: time,
              serviceText: text,
              internetMessageId: messageId,
              emailName: firstE.label,
              emailFolder: firstE.option.toString(),
              emailFolderId: firstE.option,
              emailContent: emailContent,
              attachments: attachmentsPayload,
              userID: '-1'
            }
          : {
              caseId: selectedCaseId,
              caseName: selectedCaseName,
              serviceAbbreviationType: abbreviation.toString(),
              serviceSB: sb,
              serviceTime: time,
              serviceText: text,
              internetMessageId: messageId,
              emailName: firstE ? firstE.label : '',
              emailFolder: '-1',
              emailFolderId: -1,
              emailContent: emailContent,
              attachments: attachmentsPayload,
              userID: '-1'
            };
      
        // Use the RTK Query mutation to save email
        await saveEmailInfo(payload).unwrap();
        notify('Email and attachments transferred successfully', 'success', 3000);
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
    dispatch({ type: 'email/setSelectedCase', payload: { id: selectedCaseId, name: value } });
  };
  
  const handleAttachmentChange = (items: TransferAttachmentItem[]) => {
    dispatch(setAttachmentSelected(items));
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
        caseIdDisable={selectedCaseDisable}
        transferBtnDisable={transferCaseDisable}
        transferLoading={transferLoading}
      />

      {/* Use the shared ServiceSection component in email mode */}
      <ServiceSection selectedAktKuerzel={selectedCaseName} mode="email" />
 
      {/* 4) Transfer e-mail and attachments */}
      <TransferAndAttachment 
        onSelectionChange={handleAttachmentChange}
        caseId={selectedCaseId}
      />
   
      {/* 5) Registered E-Mails */}
      <RegisteredEmails />
    </div>
  );
};

export default EmailTabContent;
