// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useState } from 'react';
import SearchAndCaseList from './SearchAndCaseList';
import ServiceSection from './ServiceSection';
import Button from 'devextreme-react/button';
import CaseSend from './CaseSend'; 
import RegisteredEmails from './RegisteredEmails';
import TransferAndAttachment from './TransferAndAttachment';


const EmailTabContent: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState('');

  const handleTransfer = () => {
    console.log('Transfer to ADVOKAT, caseId =', selectedCase);
    // tu wrzuć logicę Office.js / fetch itp.
  };

  return (
    <div>
      {/* 1) Panel wyszukiwania + lista spraw */}
      <SearchAndCaseList onCaseSelect={setSelectedCase} />
 <hr />
      <h3>Case</h3>
      <CaseSend
        caseId={selectedCase}
         onCaseChange={setSelectedCase}
        onTransfer={handleTransfer} />
      {/* 3) Sekcja Services */}
    <hr />
      <ServiceSection />
    <hr />
      {/* 4) Transfer e-mail and attachments */}
      <TransferAndAttachment />
    <hr />
       {/* 5) Registered E-Mails */}
       <RegisteredEmails />

    </div>
  );
};

export default EmailTabContent;
