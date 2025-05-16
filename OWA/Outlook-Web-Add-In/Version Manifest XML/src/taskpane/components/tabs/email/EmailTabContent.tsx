// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React from 'react';
import SearchAndCaseList from './SearchAndCaseList';
import ServiceSection from './ServiceSection';

const EmailTabContent: React.FC = () => (
  <div>
    {/* 1) Panel wyszukiwania + lista spraw */}
    <SearchAndCaseList />

    {/* 2) Sekcja Case */}
    <h3>Case</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 24px' }}>
      <input
        type="text"
        placeholder="Case ID"
        style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
      />
      <button
        style={{
          backgroundColor: 'green',
          color: 'white',
          padding: '10px 16px',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer'
        }}
      >
        Transfer to ADVOKAT
      </button>
    </div>

    {/* 3) Sekcja Services */}
    <ServiceSection />

    {/* 4) Transfer e-mail and attachments */}
    <h3>Transfer e-mail and attachments</h3>
    {/* ... tu możesz docelowo też wyciągnąć do komponentu */}

    {/* 5) Registered E-Mails */}
    <h3>
      Registered E-Mails <small style={{ color: '#888' }}>(last 7 days)</small>
    </h3>
    {/* ... reszta tabeli */}
  </div>
);

export default EmailTabContent;
