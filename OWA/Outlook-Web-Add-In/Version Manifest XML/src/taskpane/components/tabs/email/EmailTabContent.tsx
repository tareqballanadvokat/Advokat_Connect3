// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useState, useEffect } from 'react';
import SearchAndCaseList from './SearchAndCaseList';
import Button from 'devextreme-react/button';
import EmailSend from './EmailSend'; 
import RegisteredEmails from './RegisteredEmails'; 
import ServiceSection, { ServiceSectionProps } from './ServiceSection';
import { useOfficeItem } from '../../../hooks/useOfficeItem';
import TransferAndAttachment, { TransferAttachmentItem, TransferEmailItem } from './TransferAndAttachment';

interface TransferPayload {
  attachments: TransferAttachmentItem[];
  emailBody: TransferEmailItem;
}
const EmailTabContent: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState('');
  const [abbrev, setAbbrev] = useState('');
  const [time, setTime]   = useState('');
  const [text, setText]   = useState('');
  const [sb, setSb]   = useState('');
  const { messageId, emailContent } = useOfficeItem();
  const [transferData, setTransferData] = useState<TransferPayload | null>(null);

  const sendEmailHandler = async () => {
    console.log('Transfer to ADVOKAT, caseId =', selectedCase);
    console.log(sb, text,abbrev,time);

    // const item = Office.context.mailbox.item;   
    var attachements = [];
 
    const payload = {
      caseId:       selectedCase,
      serviceAbbreviationType: abbrev,
      srviceSB:           sb,         
      serviceTime:         time,
      serviceText:         text,
      internetMessageId: messageId,
      emailName:'',
      emailFolder:'',
      emailContent: emailContent,
      attachments : attachements
    };


    try {
      const response = await fetch(
        'https://localhost:7231/api/email/add-to-advocat', // <- Twój endpoint
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        // np. 400 / 500
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Transfer successful:', result);
      // tutaj możesz np. pokazać komunikat lub zresetować formularz
    } catch (err) {
      console.error('Transfer failed:', err);
      // tutaj wyświetl błąd użytkownikowi
    }
  };
 


//  //useEffect(() => { 
//     async function loadTransferData() {
//       try {
//         // const resp = await fetch('https://localhost:7231/api/email/get', {
//         //   method: 'GET'
//         // });
//     const resp =  await fetch('https://localhost:7231/api/email/get', {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
    
//     body: JSON.stringify({ id: messageId })
//   })
        
//         if (!resp.ok) throw new Error(await resp.text());
//         const data: TransferPayload = await resp.json();
//         setTransferData(data);
//       } catch (e: any) {
//   //      setError(e.message);
//       } finally {
//    //     setLoading(false);
//       }
//     }
//     loadTransferData();
// //  }, []);


  return (
    <div  >
      {/* 1) Panel wyszukiwania + lista spraw */}
      <SearchAndCaseList onCaseSelect={setSelectedCase} />
 
    
 
 {/* 3) Sekcja Services */}
      <EmailSend
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
      />
 

      {/* 4) Transfer e-mail and attachments */}
      <TransferAndAttachment 
        // initialItems={transferData.attachments || []}
        // emailBody={transferData.emailBody}
      />
   
       {/* 5) Registered E-Mails */}
       {/* <RegisteredEmails /> */}

    </div>
  );
};

export default EmailTabContent;
