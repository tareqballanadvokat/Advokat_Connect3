import React, { useState, useEffect } from 'react';
import CheckBox from 'devextreme-react/check-box';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import { useOfficeItem, getInternetMessageIdAsync, getEmailSubjectAsync, getEmailAttachments, Attachment } from '../../../hooks/useOfficeItem'; 
import { getSavedEmailInfo, getStructureFolderApi } from '../../../utils/api';

export interface TransferAttachmentItem {
  id: string;
  label: string;
  option: string;
  checked: boolean;
  readonly: boolean;
  disabled: boolean;
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

interface TransferAndAttachmentProps {
  onSelectionChange?: (selected: TransferAttachmentItem[]) => void;
}
const TransferAndAttachment: React.FC<TransferAndAttachmentProps> = ({ onSelectionChange }) => {
  const { subject, attachments } = useOfficeItem();
  const [items, setItems] = useState<TransferAttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string>();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(undefined);
      
      try {
 attachmentOptions.push('' );
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
            id: messageId, 
            checked: false,
            readonly: false,
            disabled:false,
            type: "E"
        }

        var attachmentConcatenated = emailAttachments.map(att => ({
                id: att.id,
                label: att.name,
                name: att.name,
                option: '',    // default option
                checked: false,     // or true, as needed
                readonly: false,
                disabled: false,
                type:"A"
            }));
        
        // Step 2: fetch both emailRow & attachmentRows in one POST
        const data = await getSavedEmailInfo(messageId);
        if (data!= null)
        {
            newEmailRow.option = data.emailFolder;
            newEmailRow.label = data.emailName;
            newEmailRow.id = data.internetMessageId; 
            newEmailRow.checked = true;
            newEmailRow.readonly = true;
            newEmailRow.disabled = true;

  if (data.attachments.length > 0)
        {
            data.attachments.forEach(element => {
 
                const att = element as Attachment;
                var el = attachmentConcatenated.find(x => x.id == att.id) ;
                if (el != null){
                    el.label = att.fileName;
                    el.option = att.folder;
                    el.checked = true;
                    el.readonly = true;
                    el.disabled = true;
                }
            }); 
        }
          
        };

        // Step 3: merge into a single array, emailRow first
        const allRows: TransferAttachmentItem[] = [
           newEmailRow ,
        ...attachmentConcatenated.map(att => ({
                id: att.id,
                label: att.name,
                name: att.name,
                option: att.option,    // default option
                checked: att.checked,     // or true, as needed
                readonly: att.readonly,
                disabled: att.disabled,
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

 

  const updateItem = (id: string, changes: Partial<TransferAttachmentItem>) => {
    debugger;
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
      {/* <p>
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
