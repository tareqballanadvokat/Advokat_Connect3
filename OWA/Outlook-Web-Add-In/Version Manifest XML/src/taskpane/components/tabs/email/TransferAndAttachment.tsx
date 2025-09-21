import React, { useState, useEffect } from 'react';
import CheckBox from 'devextreme-react/check-box';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import { useOfficeItem, getInternetMessageIdAsync, getEmailSubjectAsync, getEmailAttachments } from '../../../hooks/useOfficeItem'; 
import { TransferAttachmentItem, DokumentResponse, DokumentArt } from '../../interfaces/IDocument';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../../../store';
import { getAvailableFoldersAsync, clearFolders, getEmailDocumentsAsync, clearDocuments } from '../../../../store/slices/aktenSlice';
import { setAttachmentSelected } from '../../../../store/slices/emailSlice';

const TransferAndAttachment: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { 
    folderOptions, 
    foldersLoading, 
    foldersError, 
    foldersLoadedForAktId, 
    favoriteAktenDocuments,
    documentsLoadedForAktId,
    selectedAkt 
  } = useSelector((state: RootState) => state.akten);
  
  const [items, setItems] = useState<TransferAttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // Clear folders and errors ONLY when selectedAkt actually changes
  useEffect(() => {
    const currentAktId = selectedAkt?.id;
    
    // Only clear if folders were loaded for a different Akt ID
    if (foldersLoadedForAktId !== null && 
        foldersLoadedForAktId !== currentAktId && 
        currentAktId != null && 
        currentAktId !== -1) {
      console.log('Akt changed, clearing folders. Previous:', foldersLoadedForAktId, 'Current:', currentAktId);
      dispatch(clearFolders());
    }
  }, [selectedAkt?.id, foldersLoadedForAktId, dispatch]);

  // Clear documents ONLY when selectedAkt actually changes
  useEffect(() => {
    const currentAktId = selectedAkt?.id;
    
    // Only clear if documents were loaded for a different Akt ID
    if (documentsLoadedForAktId !== null && 
        documentsLoadedForAktId !== currentAktId && 
        currentAktId != null && 
        currentAktId !== -1) {
      console.log('Akt changed, clearing documents. Previous:', documentsLoadedForAktId, 'Current:', currentAktId);
      dispatch(clearDocuments());
    }
  }, [selectedAkt?.id, documentsLoadedForAktId, dispatch]);

  // Load folders only if they haven't been loaded for the current Akt
  useEffect(() => {
    if (selectedAkt?.id != null && 
        selectedAkt.id !== -1 && 
        foldersLoadedForAktId !== selectedAkt.id && // Only load if not already loaded for this Akt
        !foldersLoading && 
        !foldersError) { // Don't retry if there's already an error
      console.log('Loading folders for case:', selectedAkt.id);
      dispatch(getAvailableFoldersAsync(selectedAkt.id));
    }
  }, [selectedAkt?.id, foldersLoadedForAktId, foldersLoading, foldersError, dispatch]);

  // Load documents only if they haven't been loaded for the current Akt
  useEffect(() => {
    const loadDocuments = async () => {
      if (selectedAkt?.id != null && 
          selectedAkt.id !== -1 && 
          documentsLoadedForAktId !== selectedAkt.id) {
        try {
          const email = Office.context.mailbox.item;
          const messageId = await getInternetMessageIdAsync(email);
          console.log('Loading documents for case:', selectedAkt.id, 'and email:', messageId);
          dispatch(getEmailDocumentsAsync({ 
            aktId: selectedAkt.id, 
            outlookEmailId: messageId 
          }));
        } catch (error) {
          console.error('Failed to get message ID for document loading:', error);
        }
      }
    };

    loadDocuments();
  }, [selectedAkt?.id, documentsLoadedForAktId, dispatch]);

  useEffect(() => {
    (async () => {
      // Don't load anything if no case is selected
      if (!selectedAkt?.id) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Wait for documents to be loaded via Redux
      if (documentsLoadedForAktId !== selectedAkt.id) {
        // Documents are still loading or not loaded yet
        setLoading(true);
        return;
      }

      setLoading(true);
      setError(undefined);
      
      try {
        const email = Office.context.mailbox.item;
        
        // Use documents from Redux state instead of loading manually
        const savedDocuments = favoriteAktenDocuments;
        
        // Step 1: Email information
        const emailSubject = await getEmailSubjectAsync();
        const emailAttachments = await getEmailAttachments(email);

        // Get messageId for email row
        const messageId = await getInternetMessageIdAsync(email);

        // Find saved email document (if any)
        const savedEmailDoc = savedDocuments.find(doc => 
          doc.dokumentArt === DokumentArt.MailEmpfangen || 
          doc.dokumentArt === DokumentArt.MailGesendet
        );

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
          newEmailRow.option = 1; // Default to first folder for now
          newEmailRow.folderName = "Default"; // We'll need to map this from the folder structure
          newEmailRow.label = savedEmailDoc.betreff || emailSubject;
          newEmailRow.checked = true;
          newEmailRow.readonly = true;
          newEmailRow.disabled = true;
        }

        // Step 2: Create attachment items
        const attachmentItems: TransferAttachmentItem[] = emailAttachments.map(att => {
          // Find if this attachment is already saved
          const savedAttachmentDoc = savedDocuments.find(doc => 
            doc.dokumentArt === DokumentArt.Keine && 
            (doc.dateipfad?.includes(att.name) || doc.betreff?.includes(att.name))
          );

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
            attachmentItem.option = 1; // Default to first folder for now
            attachmentItem.folderName = "Default"; // We'll need to map this from the folder structure
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
        console.error(e);
        setError(e.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedAkt?.id, documentsLoadedForAktId, favoriteAktenDocuments]);

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
