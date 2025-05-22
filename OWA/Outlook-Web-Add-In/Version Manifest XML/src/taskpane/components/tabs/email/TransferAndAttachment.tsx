import React, { useState, useEffect } from 'react';
import CheckBox from 'devextreme-react/check-box';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import { useOfficeItem, getInternetMessageIdAsync, getEmailSubjectAsync, getEmailAttachments } from '../../../hooks/useOfficeItem'; 
import { getSavedEmailInfo, getStructureFolderApi } from '../../../utils/api';

export interface TransferAttachmentItem {
  id: string;
  label: string;
  option: string;
  checked: boolean;
  readonly: boolean;
  name: string;
  type: string;
}

export interface TransferEmailItem {
  id: string;
  label: string;
  option: string;
  checked: boolean;
  readonly: boolean;
}

var attachmentOptions = ['Email', 'Aktenordner', 'Andere…'];
// your “extra” rows, e.g. for folder-transfer
// const emailRow: Omit<TransferAttachmentItem, 'readonly'>[] = [ 
// ];
// interface TransferAndAttachmentProps {
//   /** Called whenever the set of checked items changes.
//       Receives array of { id, label } for all checked rows */
//   onSelectionChange?: (selected: { id: string; label: string }[]) => void;
// }
interface TransferAndAttachmentProps {
  onSelectionChange?: (selected: TransferAttachmentItem[]) => void;
}
const TransferAndAttachment: React.FC<TransferAndAttachmentProps> = ({ onSelectionChange }) => {
//   const { subject, composeMode, itemAttachments , messageId} = useOfficeItem();
const { subject, attachments, emailContent, composeMode } = useOfficeItem();
  const [items, setItems] = useState<TransferAttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string>();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(undefined);
      
      try {

        // Step 1: Dictionaries        
        const options = await getStructureFolderApi();
        options.forEach(item => { attachmentOptions.push(  item.name ); });

        // Step 1: Email informations
        const email = Office.context.mailbox.item;
        const messageId = await getInternetMessageIdAsync(email);
        const emailSubject = await getEmailSubjectAsync();
        const emailAttachments = await getEmailAttachments(email);
 
        const newEmailRow: TransferAttachmentItem = {
            label :emailSubject,
            name: emailSubject,
            option:"Email",
            id: "1", 
            checked: false,
            readonly: false,
            type: "E"
        }
        // Step 2: fetch both emailRow & attachmentRows in one POST
        const data = await getSavedEmailInfo(messageId);
        if (data!= null)
        {
            newEmailRow.option = data.emailFolder;
            newEmailRow.label = data.emailName;
            newEmailRow.id = data.internetMessageId; 
            newEmailRow.checked = newEmailRow.readonly = true;
        };
 

        // Step 3: merge into a single array, emailRow first
        const allRows: TransferAttachmentItem[] = [
           newEmailRow ,
        ...emailAttachments.map(att => ({
                id: att.id,
                label: att.name,
                name: att.name,
                option: 'Email',    // default option
                checked: false,     // or true, as needed
                readonly: false,
                type:"A"
            }))
        ];
        setItems(allRows);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [subject, attachments]);

  if (loading) return <div>Loading…</div>;
  if (error)   return <div style={{ color: 'red' }}>Error: {error}</div>;

//   const updateItem = (id: string, changes: Partial<TransferAttachmentItem>) => {
//     setItems(prev =>
//       prev.map(item => (item.id === id ? { ...item, ...changes } : item))
//     );
//   };

//   const updateItem = (id: string, changes: Partial<TransferAttachmentItem>) => {
//     setItems(prev => {
//       const updated = prev.map(item => item.id === id ? { ...item, ...changes } : item);
//       if (onSelectionChange) {
//         // extract checked items and their labels
//         const selected = updated
//           .filter(i => i.checked)
//           .map(i => ({ id: i.id, label: i.label }));
//         onSelectionChange(selected);
//       }
//       return updated;
//     });
//   };


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
      {/* <h3>Transfer e-mail and attachments</h3>
      <p>
        <strong>Mode:</strong> {composeMode ? 'Compose' : 'Read-only'}<br/>
        <strong>Subject:</strong> {subject}
      </p> */}

      {items.map(item => (
        <div
          key={item.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
        >
          <CheckBox
            value={item.checked}
            readOnly={item.readonly}
            onValueChanged={e => updateItem(item.id, { checked: e.value })}
          />
          <TextBox
            stylingMode="outlined"
            value={item.label}
            readOnly={item.readonly}
            onValueChanged={e => updateItem(item.id, { label: e.value })}
            width="100%"
          />
          <SelectBox
            stylingMode="outlined"
            dataSource={attachmentOptions}
            value={item.option}
            disabled={item.readonly}
            onValueChanged={e => updateItem(item.id, { option: e.value })}
            width={150}
          />
        </div>
      ))}
    </div>
  );
};

export default TransferAndAttachment;
