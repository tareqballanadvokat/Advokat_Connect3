// src/taskpane/components/tabs/email/ServiceSection.tsx
import React from 'react';

const ServiceSection: React.FC = () => (
  <div style={{ marginBottom: 24 }}>
    <h3>Services</h3>
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
      <input
        type="text"
        placeholder="Abbreviation"
        style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
      />
      <input
        type="text"
        value="SB"
        readOnly
        style={{
          width: 64,
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
        style={{ width: 80, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
      />
    </div>
    <input
      type="text"
      placeholder="Text"
      style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
    />
  </div>
);

export default ServiceSection;
