// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useState, useEffect } from 'react';
import SearchAndCaseList from './SearchAndCaseList';
import ServiceSection, { ServiceSectionProps } from './ServiceSection';
import { useOfficeItem } from '../../../hooks/useOfficeItem'; 

 
const ServiceTabContent: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState('');
  const [abbrev, setAbbrev] = useState('');
  const [time, setTime]   = useState('');
  const [text, setText]   = useState('');
  const [sb, setSb]   = useState('');
  const { messageId, emailContent } = useOfficeItem();
 // const [transferData, setTransferData] = useState<TransferPayload | null>(null);

 
 
  return (
    <div  >
 
    <SearchAndCaseList onCaseSelect={setSelectedCase} />
    <ServiceSection
        abbreviation={abbrev}
        onAbbreviationChange={setAbbrev}
        time={time}
        onTimeChange={setTime}
        text={text}
        onTextChange={setText}
        sb={sb}
        onSbChange={setSb}
      />
    </div>
  );
};
export default ServiceTabContent;
