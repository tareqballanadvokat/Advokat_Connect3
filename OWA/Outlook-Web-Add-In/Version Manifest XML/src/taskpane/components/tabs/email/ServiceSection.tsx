// src/taskpane/components/tabs/email/ServiceSection.tsx
import React, { useState, useEffect } from 'react';
import SelectBox from 'devextreme-react/select-box';
import { getAbbreviationApi, Abbreviation } from '../../../utils/api';

// export interface Abbreviation {
//   id: string;
//   name: string;
// }

export interface ServiceSectionProps {
  abbreviation: string;
  onAbbreviationChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  text: string;
  onTextChange: (value: string) => void;
  sb: string;
  onSbChange: (value: string) => void;
}

const ServiceSection: React.FC<ServiceSectionProps> = ({
  abbreviation,
  onAbbreviationChange,
  time,
  onTimeChange,
  text,
  onTextChange,
  sb,
  onSbChange,
}) => {
  const [options, setOptions] = useState<Abbreviation[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAbbreviationApi(); // => Abbreviation[]
        setOptions(data);
      } catch (err) {
        console.error('Failed to load abbreviations:', err);
      }
    })();
  }, []);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3>Services</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <SelectBox
          stylingMode="outlined"
          dataSource={options}
          value={abbreviation}
          valueExpr="id"
          displayExpr="name"
          placeholder="Abbreviation"
          onValueChanged={e => onAbbreviationChange(e.value)}
          width={130}
        />
        <input
          type="text"
          placeholder="SB"
          value={sb}
          onChange={e => onSbChange(e.target.value)}
          style={{
            width: 25,
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #ccc',
            borderRadius: 4,
            textAlign: 'center',
            backgroundColor: '#f4f4f4',
          }}
        />
        <input
          type="text"
          placeholder="Time"
          value={time}
          onChange={e => onTimeChange(e.target.value)}
          style={{
            width: 40,
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
        />
      </div>
      <input
        type="text"
        placeholder="Text"
        value={text}
        onChange={e => onTextChange(e.target.value)}
        style={{
          width: 262,
          padding: '8px 12px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
      />
    </div>
  );
};

export default ServiceSection;
