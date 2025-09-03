import React, { useState, useEffect } from 'react';
import CheckBox from 'devextreme-react/check-box';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import { useOfficeItem, getInternetMessageIdAsync, getEmailSubjectAsync, getEmailAttachments } from '../../../hooks/useOfficeItem'; 
import { webRTCApiService } from '../../../services/webRTCApiService';
import { TransferAttachmentItem, DokumentResponse, DokumentArt } from '../../interfaces/IDocument';

interface TransferAndAttachmentProps {
  aktId: number; // Selected case ID from EmailTabContent
  onSelectionChange?: (selected: TransferAttachmentItem[]) => void; // Callback to notify parent
}
const TransferAndAttachment: React.FC<TransferAndAttachmentProps> = ({ aktId, onSelectionChange }) => {
  const [items, setItems] = useState<TransferAttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [folderOptions, setFolderOptions] = useState<{id: number, text: string}[]>([]);

  // Helper function to get folder name from option ID
  const getFolderNameByOption = (optionId: number): string => {
    const folder = folderOptions.find(f => f.id === optionId);
    return folder?.text || 'Default';
  };

  // Load folders whenever aktId changes
  useEffect(() => {
    const loadFolders = async () => {
      if (aktId != null && aktId != -1) {
        console.log('Loading folders for case:', aktId);
        try {
          // Check if WebRTC connection is ready
          if (webRTCApiService.isReady()) {
            const foldersResponse = await webRTCApiService.getAvailableFolders(aktId);
            
            if (foldersResponse.response.statusCode >= 200 && foldersResponse.response.statusCode < 300) {
              // Debug: Log the actual response structure
              console.log('Raw folders response:', foldersResponse);
              console.log('Raw folders data:', JSON.parse(foldersResponse.response.body || '[]'));
              
              // The fake response returns data as an array of strings directly
              // Based on webRTCApiService.ts fake response structure
              const responseData = JSON.parse(foldersResponse.response.body || '[]');
              const folderNames = Array.isArray(responseData) 
                ? responseData.map(folder => String(folder))
                : [];
              
              // Transform folder strings to options format
              const newOptions = folderNames.map((folderName, index) => ({
                id: index + 1, // Use index + 1 as ID
                text: folderName
              }));
              
              setFolderOptions(newOptions);
              console.log('Processed folder names:', folderNames);
              console.log('Final folder options:', newOptions);
            } else {
              console.warn('Failed to load folders via WebRTC');
              setFolderOptions([]);
            }
          } else {
            console.warn('WebRTC not ready, no fallback available');
            setFolderOptions([]);
          }
        } catch (error) {
          console.error('Error loading folders:', error);
          setFolderOptions([]);
        }
      } else {
        setFolderOptions([]);
      }
    };

    loadFolders();
  }, [aktId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(undefined);
      
      try {
        const email = Office.context.mailbox.item;
        const messageId = await getInternetMessageIdAsync(email);
        
        // Get saved documents from Advokat via WebRTC
        const documentsResponse = await webRTCApiService.getSavedEmailInfo(messageId, aktId);
        let savedDocuments: DokumentResponse[] = [];
        
        if (documentsResponse.response.statusCode >= 200 && documentsResponse.response.statusCode < 300) {
          savedDocuments = JSON.parse(documentsResponse.response.body || '[]');
        } else {
          console.warn('Failed to get saved documents');
        }
        
        // Step 1: Email information
        const emailSubject = await getEmailSubjectAsync();
        const emailAttachments = await getEmailAttachments(email);

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
  }, [aktId]);

  if (loading) return <div>Loading…</div>;
  if (error)   return <div style={{ color: 'red' }}>Error: {error}</div>;

 

  const updateItem = (id: string, changes: Partial<TransferAttachmentItem>) => {
 
    setItems(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...changes } : item);
      if (onSelectionChange) {
        const selectedItems = updated.filter(i => i.checked);
        onSelectionChange(selectedItems);
      }
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
