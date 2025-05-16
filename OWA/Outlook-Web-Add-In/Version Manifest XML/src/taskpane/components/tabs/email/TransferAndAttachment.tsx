// src/taskpane/components/tabs/email/TransferAndAttachment.tsx
import React, { useState } from 'react';
import CheckBox from 'devextreme-react/check-box';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';

interface TransferAttachmentItem {
  id: string;
  label: string;
  option: string;
  checked: boolean;
}

// przykładowe opcje do dropdowna
const attachmentOptions = [
  'Email',
  'Aktenordner',
  'Andere…'
];

// domyślne wiersze
const initialItems: TransferAttachmentItem[] = [
  {
    id: '1',
    label: 'Dietmar.harb@advokat.at (18:)',
    option: 'Email',
    checked: false
  },
  {
    id: '2',
    label: 'Zusatzvereinbarung',
    option: 'Aktenordner',
    checked: false
  }
];

const TransferAndAttachment: React.FC = () => {
  const [items, setItems] = useState<TransferAttachmentItem[]>(initialItems);

  const updateItem = (
    id: string,
    changes: Partial<TransferAttachmentItem>
  ) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              ...changes
            }
          : item
      )
    );
  };

  return (
    <div>
      <h3>Transfer e-mail and attachments</h3>
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
          {/* Checkbox */}
          <CheckBox
            value={item.checked}
            onValueChanged={e => updateItem(item.id, { checked: e.value })}
          />

          {/* Text label / editable field */}
          <TextBox
            stylingMode="outlined"
            value={item.label}
            onValueChanged={e => updateItem(item.id, { label: e.value })}
            width="100%"
          />

          {/* Dropdown select */}
          <SelectBox
            stylingMode="outlined"
            dataSource={attachmentOptions}
            value={item.option}
            onValueChanged={e => updateItem(item.id, { option: e.value })}
            width={150}
          />
        </div>
      ))}
    </div>
  );
};

export default TransferAndAttachment;
