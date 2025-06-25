// src/taskpane/components/tabs/email/ServiceSection.tsx
import React from 'react';

export interface ServiceSectionProps {
  abbreviation: string;
  onAbbreviationChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  text: string;
  onTextChange: (value: string) => void;
  sb: string
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
}) => (
  <div style={{ marginBottom: 24 }}>
    <h3>Services</h3>
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
      <input
        type="text"
        placeholder="Abbreviation"
        value={abbreviation}
        onChange={e => onAbbreviationChange(e.target.value)}
        style={{
          width: 130,
          padding: '8px 12px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
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

export default ServiceSection;
