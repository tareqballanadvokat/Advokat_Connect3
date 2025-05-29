// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useState, useEffect } from 'react';
// import SearchAndCaseList from './SearchAndCaseList';
import ServiceSection, { ServiceSectionProps } from '../shared/ServiceSection';
import SearchCaseList from '../email/SearchCaseList'; 
import ServiceSend from './ServiceSend';
import RegisteredService from './RegisteredService';
import  { saveServiceInformation } from './../../../utils/api';

import { useOfficeItem, getInternetMessageIdAsync, getEmailSubjectAsync, getEmailAttachments } from '../../../hooks/useOfficeItem'; 

const ServiceTabContent: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState('');
  // const [abbrev, setAbbrev] = useState('');  
  const [abbrev, setAbbrev] = useState<number>(0);
  const [time, setTime]   = useState('');
  const [text, setText]   = useState('');
  const [sb, setSb]   = useState('');
  const { messageId, emailContent } = useOfficeItem();
 // const [transferData, setTransferData] = useState<TransferPayload | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);


  const sendEmailHandler = async () => {
    console.log('Transfer to ADVOKAT, caseId =', selectedCase);
    console.log(sb, text,abbrev,time);
 
  const email = Office.context.mailbox.item;
  const messageId= await getInternetMessageIdAsync(email);

 
  const payload   =
   {
      caseId:       selectedCase,
      serviceAbbreviationType:  abbrev.toString(),
      serviceSB:           sb,         
      serviceTime:         time,
      serviceText:         text,
      internetMessageId: messageId,
      userId :1
    }
 
    const data = await saveServiceInformation(payload);
   setRefreshFlag(f => f + 1);
  };


 
 
  return (
    <div  >
 
    <SearchCaseList onCaseSelect={setSelectedCase} />
    <ServiceSend     
        caseId={selectedCase}
        onCaseChange={setSelectedCase}
        onTransfer={sendEmailHandler}
        abbreviation={abbrev}
        sb={sb}
        time={time}
        text={text} />
    <ServiceSection
        abbreviation={abbrev}
        onAbbreviationChange={setAbbrev}
        time={time}
        onTimeChange={setTime}
        text={text}
        onTextChange={setText}
        sb={sb}
        onSbChange={setSb}
        oveerideDataOnStartup={false}
      />

<RegisteredService  refreshTrigger={refreshFlag}  />
    </div>
  );
};
export default ServiceTabContent;
