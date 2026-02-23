import React, { useState, useEffect } from 'react';
import CheckBox from 'devextreme-react/check-box';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import { useOfficeItem, getInternetMessageIdAsync, getEmailSubjectAsync, getEmailAttachments } from '../../../hooks/useOfficeItem'; 
import { TransferAttachmentItem, DokumentResponse, DokumentArt } from '../../interfaces/IDocument';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../../../store';
import { getAvailableFoldersAsync, clearFolders, getEmailDocumentsAsync, clearEmailDocuments, selectEmailDocuments } from '../../../../store/slices/aktenSlice';
import { setAttachmentSelected } from '../../../../store/slices/emailSlice';
import { getLogger } from '../../../../services/logger';

const logger = getLogger();

const TransferAndAttachment: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { 
    folderOptions, 
    foldersLoading, 
    foldersError, 
    foldersLoadedForAktId,
    emailDocuments,
    emailDocumentsLoadedForAktId,
    selectedAkt 
  } = useSelector((state: RootState) => state.akten);
  
  const [items, setItems] = useState<TransferAttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  /**
   * Extract folder name from the document's file path by going backwards from filename
   * Example: C:\\ADVOKAT\\Daten\\WINWORD\\ADVOKAT\\TEST\\Email\\Keine\\file.png → "Email"
   * Example: C:\\ADVOKAT\\Daten\\WINWORD\\ADVOKAT\\TEST\\Default\\MailEmpfangen\\file.eml → "Default"
   */
  const extractFolderFromPath = (dateipfad: string | undefined): string => {
    if (!dateipfad) return "Default";

    const parts = dateipfad.split(/[\\/]/).filter(p => p.length > 0);
    
    if (parts.length < 2) return "Default";
    
    // DokumentArt subfolders that should be skipped
    const dokumentArtFolders = ["MailEmpfangen", "MailGesendet", "Keine"];
    
    // Start from the end (filename is last) and go backwards
    // Skip the filename itself (last element)
    for (let i = parts.length - 2; i >= 0; i--) {
      const folder = parts[i];
      // Skip DokumentArt folders, return the first non-DokumentArt folder
      if (!dokumentArtFolders.includes(folder)) {
        return folder;
      }
    }
    
    return "Default";
  };

  // Clear folders and errors ONLY when selectedAkt actually changes
  useEffect(() => {
    const currentAktId = selectedAkt?.id;
    
    // Only clear if folders were loaded for a different Akt ID
    if (foldersLoadedForAktId !== null && 
        foldersLoadedForAktId !== currentAktId && 
        currentAktId != null && 
        currentAktId !== -1) {
      logger.debug(`Akt changed, clearing folders. Previous: ${foldersLoadedForAktId}, Current: ${currentAktId}`, 'TransferAndAttachment');
      dispatch(clearFolders());
    }
  }, [selectedAkt?.id, foldersLoadedForAktId, dispatch]);

  // Load folders only if they haven't been loaded for the current Akt
  useEffect(() => {
    if (selectedAkt?.id != null && 
        selectedAkt.id !== -1 && 
        foldersLoadedForAktId !== selectedAkt.id && // Only load if not already loaded for this Akt
        !foldersLoading && 
        !foldersError) { // Don't retry if there's already an error
      logger.debug('Loading folders for case: ' + selectedAkt.id, 'TransferAndAttachment');
      dispatch(getAvailableFoldersAsync(selectedAkt.id));
    }
  }, [selectedAkt?.id, foldersLoadedForAktId, foldersLoading, foldersError, dispatch]);

  // Clear email documents when Akt changes and load documents for the current Akt
  useEffect(() => {
    const loadDocuments = async () => {
      const currentAktId = selectedAkt?.id;
      
      // Clear documents if they were loaded for a different Akt ID
      if (emailDocumentsLoadedForAktId !== null && 
          emailDocumentsLoadedForAktId !== currentAktId && 
          currentAktId != null && 
          currentAktId !== -1) {
        logger.debug(`Akt changed, clearing email documents. Previous: ${emailDocumentsLoadedForAktId}, Current: ${currentAktId}`, 'TransferAndAttachment');
        dispatch(clearEmailDocuments());
      }
      
      // Load documents if they haven't been loaded for the current Akt
      if (currentAktId != null && 
          currentAktId !== -1 && 
          emailDocumentsLoadedForAktId !== currentAktId) {
        try {
          const email = Office.context.mailbox.item;
          const messageId = await getInternetMessageIdAsync(email);
          logger.debug(`Loading documents for case: ${currentAktId} and email: ${messageId}`, 'TransferAndAttachment');
          dispatch(getEmailDocumentsAsync({ 
            aktId: currentAktId, 
            outlookEmailId: messageId || undefined // Handle missing messageId gracefully
          }));
        } catch (error) {
          logger.error('Failed to get message ID for document loading:', 'TransferAndAttachment', error);
          // Still attempt to load documents without email ID
          dispatch(getEmailDocumentsAsync({ 
            aktId: currentAktId, 
            outlookEmailId: undefined 
          }));
        }
      }
    };

    loadDocuments();
  }, [selectedAkt?.id, emailDocumentsLoadedForAktId, dispatch]);

  useEffect(() => {
    (async () => {
      // Don't load anything if no case is selected
      if (!selectedAkt?.id) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Wait for email documents to be loaded via Redux
      if (emailDocumentsLoadedForAktId !== selectedAkt.id) {
        // Documents are still loading or not loaded yet
        setLoading(true);
        return;
      }

      setLoading(true);
      setError(undefined);
      
      try {
        const email = Office.context.mailbox.item;
        
        // Use email documents from Redux state instead of loading manually
        const savedDocuments = emailDocuments;
        
        // Step 1: Email information
        const emailSubject = await getEmailSubjectAsync();
        const emailAttachments = await getEmailAttachments(email);

        // Get messageId for email row
        const messageId = await getInternetMessageIdAsync(email);
        logger.debug('Current email messageId: ' + messageId, 'TransferAndAttachment');
        logger.debug(`Saved documents: ${savedDocuments.length} found`, 'TransferAndAttachment');
        
        // Find saved email document by matching outlookEmailId
        const savedEmailDoc = savedDocuments.find(doc => {
          // Check if this document has an outlookEmailId that matches the current email
          const hasMatchingId = doc.outlookEmailId && doc.outlookEmailId === messageId;

          logger.debug(`Checking doc ${doc.id}: outlookEmailId=${doc.outlookEmailId}, matches=${hasMatchingId}`, 'TransferAndAttachment');
          
          return hasMatchingId;
        });

        const newEmailRow: TransferAttachmentItem = {
          label: emailSubject,
          name: emailSubject,
          option: -1,
          id: messageId, 
          checked: false,
          readonly: false,
          disabled: false,
          type: "E",
          folderName: "Default",
          document: savedEmailDoc
        };

        // If email is already saved, mark it as disabled and readonly
        if (savedEmailDoc) {
          const folderName = extractFolderFromPath(savedEmailDoc.dateipfad);
          logger.debug(`Extracted folder for email from path "${savedEmailDoc.dateipfad}": "${folderName}"`, 'TransferAndAttachment');
          
          // Find the matching folder option by name
          const matchingFolder = folderOptions.find(f => f.text === folderName);
          const optionId = matchingFolder?.id ?? folderOptions[0]?.id ?? 1;
          logger.debug(`Matched folder "${folderName}" to option ID: ${optionId}`, 'TransferAndAttachment');
          
          newEmailRow.option = optionId;
          newEmailRow.folderName = folderName;
          newEmailRow.label = savedEmailDoc.betreff || emailSubject;
          newEmailRow.checked = true;
          newEmailRow.readonly = true;
          newEmailRow.disabled = true;
        }

        // Step 2: Create attachment items
        const attachmentItems: TransferAttachmentItem[] = emailAttachments.map(att => {
          // Find if this attachment is already saved
          // Match by outlookEmailId (email context) and attachment name
          const savedAttachmentDoc = savedDocuments.find(doc => {
            // Must be a file attachment (not an email)
            // Handle both string and numeric enum values from server
            const isAttachment = doc.dokumentArt === DokumentArt.Keine || 
                               doc.dokumentArt === "Keine" || 
                               (doc.dokumentArt as any) === 0;
            // Must belong to the same email (via outlookEmailId)
            const belongsToThisEmail = doc.outlookEmailId && doc.outlookEmailId === messageId;
            // Must match the attachment name
            const nameMatches = doc.dateipfad?.includes(att.name) || 
                               doc.betreff?.includes(att.name) || 
                               doc.fileName?.includes(att.name);
            
            logger.debug(`Checking attachment "${att.name}" against doc ${doc.id}: isAttachment=${isAttachment}, belongsToThisEmail=${belongsToThisEmail}, nameMatches=${nameMatches}`, 'TransferAndAttachment');
            
            return isAttachment && belongsToThisEmail && nameMatches;
          });

          const attachmentItem: TransferAttachmentItem = {
            id: att.id,
            label: att.name,
            name: att.name,
            option: -1,
            checked: false,
            readonly: false,
            disabled: false,
            type: "A",
            folderName: "Default",
            document: savedAttachmentDoc
          };

          // If attachment is already saved, mark it as disabled and readonly
          if (savedAttachmentDoc) {
            const folderName = extractFolderFromPath(savedAttachmentDoc.dateipfad);
            logger.debug(`Extracted folder for attachment "${att.name}" from path "${savedAttachmentDoc.dateipfad}": "${folderName}"`, 'TransferAndAttachment');
            
            // Find the matching folder option by name
            const matchingFolder = folderOptions.find(f => f.text === folderName);
            const optionId = matchingFolder?.id ?? folderOptions[0]?.id ?? 1;
            logger.debug(`Matched folder "${folderName}" to option ID: ${optionId}`, 'TransferAndAttachment');
            
            attachmentItem.option = optionId;
            attachmentItem.folderName = folderName;
            attachmentItem.label = savedAttachmentDoc.betreff || att.name;
            attachmentItem.checked = true;
            attachmentItem.readonly = true;
            attachmentItem.disabled = true;
          }

          return attachmentItem;
        });

        // Step 3: merge into a single array, email first
        const allRows: TransferAttachmentItem[] = [newEmailRow, ...attachmentItems];
        setItems(allRows);
      } catch (e: any) {
        logger.error('Error loading transfer items:', 'TransferAndAttachment', e);
        setError(e.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedAkt?.id, emailDocumentsLoadedForAktId, emailDocuments]);

  if (loading) return <div>Loading…</div>;
  if (error)   return <div style={{ color: 'red' }}>Error: {error}</div>;

  const updateItem = (id: string, changes: Partial<TransferAttachmentItem>) => {
 
    setItems(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...changes } : item);
      const selectedItems = updated.filter(i => i.checked);
      dispatch(setAttachmentSelected(selectedItems));
      return updated;
    });
  };

  return (
    <div>
      <h3>Transfer e-mail and attachments</h3>

      {items.map(item => (
        <div
          key={item.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
        >
          <CheckBox
            value={item.checked}
            readOnly={item.readonly}
            disabled={item.disabled}
            onValueChanged={e => updateItem(item.id, { checked: e.value })}
          />
          <TextBox
            stylingMode="outlined"
            value={item.label}
           
            onValueChanged={e => updateItem(item.id, { label: e.value })}
            width="100%"
          />
 
          <SelectBox
            stylingMode="outlined"
            dataSource={folderOptions}
            displayExpr="text"   // the field to show
            valueExpr="id"       // the field to use as the actual value
            value={item.option}  // now this should be the numeric id
            disabled={item.readonly}
            onValueChanged={e => {
              const selectedFolder = folderOptions.find(f => f.id === e.value);
              updateItem(item.id, { 
                option: e.value,
                folderName: selectedFolder?.text || 'Default'
              });
            }}
            width={150}
          />
        </div>
      ))}
    </div>
  );
};

export default TransferAndAttachment;
