// src/taskpane/components/tabs/email/TransferAndAttachment.tsx
import React, { useState, useEffect } from 'react';
import CheckBox from 'devextreme-react/check-box';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import { useOfficeItem } from '../../../hooks/useOfficeItem';

export interface TransferAttachmentItem {
  id: string;
  label: string;
  option: string;
  checked: boolean;
  readonly: boolean;
}
export interface TransferEmailItem {
  id: string;
  label: string;
  option: string;
  checked: boolean;
  readonly: boolean;
}

interface Props {
  initialItems: TransferAttachmentItem[];
  emailBody: TransferEmailItem;
}

const attachmentOptions = ['Email', 'Aktenordner', 'Andere…'];

// your “extra” rows, e.g. for folder-transfer
const emailRow: Omit<TransferAttachmentItem, 'readonly'>[] = [
 // { id: '1', label: 'Dietmar.harb@advokat.at (18:)', option: 'Email', checked: false } 
];

// const TransferAndAttachment: React.FC<Props> = () => {// ({ initialItems, emailBody }) => {
const TransferAndAttachment: React.FC = () => {// ({ initialItems, emailBody }) => {
  const { subject, messageId, composeMode, itemAttachments } = useOfficeItem();
  const [items, setItems] = useState<TransferAttachmentItem[]>([]);
  const [transferData, setTransferData] = useState<TransferEmailItem | null>(null);

  // whenever the Office attachments load or change, build our items
  useEffect(() => {
    const itemAttachmentFromOffice: TransferAttachmentItem[] = (itemAttachments || []).map(att => ({
      id: att.id,
      label: att.name,
      option: 'Email',
      checked: false,
      readonly: false
    }));

//     useEffect(async () => { 
  
//          try {
//             const resp =  await fetch('https://localhost:7231/api/email/get', {
//             method: "POST",
//             headers: {
//             "Content-Type": "application/json"
//             },
            
//             body: JSON.stringify({ id: messageId })
//         })
                
//         // if (!resp.ok) throw new Error(await resp.text());
//         // const data: TransferEmailItem = await resp.json();
//         // setTransferData(data);
//       } catch (e: any) {
//   //      setError(e.message);
//       } finally {
//    //     setLoading(false);
//       }
  
   
//  }, []);


// const ssss: TransferAttachmentItem[] = (initialItems || []).map(att => ({
//       id: att.id,
//       label: att.label,
//       option: 'Email',
//       checked: false,
//       readonly: false
//     }));
//     console.log(ssss);
 
    const newEmailRow: TransferAttachmentItem = {
        // label :emailBody.label,
        // option: emailBody.option,
        // id: emailBody.id  ,     
                label :"",
        option:"Email",
        id: "1", 
        checked: true,
        readonly: false
    };

    setItems([newEmailRow, ...itemAttachmentFromOffice]);
  }, [itemAttachments]);

  const updateItem = (id: string, changes: Partial<TransferAttachmentItem>) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  };

  return (
    <div>
      <h3>Transfer e-mail and attachments</h3>
      <p>
        <strong>Mode:</strong> {composeMode ? 'Compose' : 'Read-only'}<br/>
        <strong>Subject:</strong> {subject}<br/>
        <strong>Message-ID:</strong> {messageId}
      </p>

      {items.map(item => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8
          }}
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
            onValueChanged={e => updateItem(item.id, { option: e.value })}
            disabled={item.readonly}
            width={150}
          />
        </div>
      ))}
    </div>
  );
};

export default TransferAndAttachment;
