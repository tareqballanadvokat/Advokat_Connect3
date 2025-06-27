// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useState, useEffect } from 'react';
// import SearchAndCaseList from './SearchAndCaseList';
import ServiceSection, { ServiceSectionProps } from '../shared/ServiceSection';
import SearchCaseList from '../email/SearchCaseList'; 
import ServiceSend from '../email/EmailSend';
import RegisteredService from './RegisteredService';
import  { saveServiceInformation } from './../../../utils/api';

import {  getInternetMessageIdAsync } from '../../../hooks/useOfficeItem'; 

const ServiceTabContent: React.FC = () => {
    //Search Panel selection
    const [selectedCaseName, setSelectedCaseName] = useState(''); //case name
    const [selectedCaseId, setSelectedCaseId]     = useState(-1);  //case id

  // const [abbrev, setAbbrev] = useState('');  
  const [abbrev, setAbbrev] = useState<number>(0);
  const [time, setTime]   = useState('');
  const [text, setText]   = useState('');
  const [sb, setSb]   = useState('');
  // const { messageId, emailContent } = useOfficeItem();
  const [refreshFlag, setRefreshFlag] = useState(0);
  //SendEmail buttons 
  const [selectedCaseDisable, setSelectedCaseDisable] = useState(false); //is input disabled if email was registered
  const [transferCaseDisable, setTransferCaseDisable] = useState(true);   //is button on availabe when input not filled

  const sendEmailHandler = async () => {
 
    console.log(sb, text,abbrev,time);
 
  const email = Office.context.mailbox.item;
  const messageId= await getInternetMessageIdAsync(email);

 
  const payload   =
   {
      caseId:       selectedCaseId,
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


   const setCaseHandler = async (id: string, name: string) => {
      console.log(id, name);
      setSelectedCaseName(name);
      setSelectedCaseId(Number.parseInt(id));
      // setTransferCaseDisable(false);
  }

   useEffect(() => {
     (() => {
       if( text != '' && time != '' && time != '' && selectedCaseId != -1)
             setTransferCaseDisable(false); 
 
       if( text == '' || time == '' || time == '' || selectedCaseId == -1)
             setTransferCaseDisable(true); 
 
      })();
   }, [text, time, selectedCaseId, abbrev, sb]);
 
 
 
  return (
    <div  >
 
    <SearchCaseList onCaseSelect={setCaseHandler} />
    <ServiceSend     
        caseId={selectedCaseName}
        onCaseChange={setSelectedCaseName}
        onTransfer={sendEmailHandler}
        caseIdDisable={selectedCaseDisable}
        transferBtnDisable={transferCaseDisable} 
        />

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
