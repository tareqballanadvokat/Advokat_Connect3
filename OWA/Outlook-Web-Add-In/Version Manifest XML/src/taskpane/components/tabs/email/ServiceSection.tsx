// src/taskpane/components/tabs/email/ServiceSection.tsx
import React from 'react';

const ServiceSection: React.FC = () => (
  <div style={{ marginBottom: 24 }}>
    <h3>Services</h3>
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
      <input
        type="text"
        placeholder="Abbreviation"
        style={{ width:130, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
      />
      <input
        type="text"
        placeholder="SB"
        style={{
          width: 25,
          padding: '8px 12px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 4,
          textAlign: 'center',
          backgroundColor: '#f4f4f4'
        }}
      />
      <input
        type="text"
        placeholder="Time"
        style={{ width: 40, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
      />
    </div>
    <input
      type="text"
      placeholder="Text"
      style={{ width: 262, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
    />
  </div>
);

export default ServiceSection;
