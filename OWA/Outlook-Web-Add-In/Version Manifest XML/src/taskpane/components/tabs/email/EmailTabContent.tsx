// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useState, useEffect } from 'react';
import SearchCaseList from './SearchCaseList'; 
import notify from 'devextreme/ui/notify';
import EmailSend from './EmailSend'; 
import RegisteredEmails from './RegisteredEmails';  
// import ServiceSection, { ServiceSectionProps } from '../shared/ServiceSection';
import ServiceSection, { ServiceSectionProps } from '../shared/ServiceSection';
import { getEmailAttachmentData, getEmailContentAsync } from '../../../hooks/useOfficeItem';
import TransferAndAttachment, { TransferAttachmentItem, TransferEmailItem } from './TransferAndAttachment';
import { saveEmailInformation, Attachment, getSavedEmailInfo , EmailModel  } from '../../../utils/api';

import {  getInternetMessageIdAsync } from '../../../hooks/useOfficeItem'; 
import DropAttachArea from '../shared/DropAttachArea';   // ← import it

async function mapToAttachments(
  items: TransferAttachmentItem[]
): Promise<Attachment[]> {
  const selected = items.filter(i => i.checked);

  // jeśli chcesz od razu pobrać zawartość w base64:
  const results = await Promise.all(selected.map(async i => {
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      Office.context.mailbox.item.getAttachmentContentAsync(i.id, ar => {
        if (ar.status === Office.AsyncResultStatus.Succeeded) {
          resolve(ar.value.content); // base64
        } else {
          resolve(''); // lub reject(ar.error.message)
          reject('');
        }
      });
    });
    return {
      id: i.id,
      originalFileName: i.name,
      fileName: i.label,
      contentBase64,
      folder: i.option
    } as Attachment;
  }));
  return results;
}

const EmailTabContent: React.FC = () => {
  //Search Panel selection
  const [selectedCaseName, setSelectedCaseName] = useState(''); //case name
  const [selectedCaseId, setSelectedCaseId]     = useState(-1);  //case id
  //SendEmail buttons 
  const [selectedCaseDisable, setSelectedCaseDisable] = useState(false); //is input disabled if email was registered
  const [transferCaseDisable, setTransferCaseDisable] = useState(true);   //is button on availabe when input not filled
  //Service section setters
  const [abbrev, setAbbrev] = useState<number>(0);
  const [time, setTime]     = useState('');
  const [text, setText]     = useState('');
  const [sb, setSb]         = useState(''); 
  //Transfer email and attachments
  const [attachmentSelected, setAttachmentSelected] = useState<TransferAttachmentItem[]>([]);

  useEffect(() => {
    (async () => {
 
      try {
        // Step 1: Email informations
        const email = Office.context.mailbox.item;
        const messageId = await getInternetMessageIdAsync(email);
        // Step 2: fetch both emailRow & attachmentRows in one POST
        const data = await getSavedEmailInfo(messageId);
        if (data!= null)
        {
            setSelectedCaseName(data.caseName);
           // setSelectedCaseDisable(true);
             setTransferCaseDisable(false);
            const abbreviationId = Number(data.serviceAbbreviationType);
            setAbbrev(abbreviationId);
            setText(data.serviceText);
            setTime(data.serviceTime);
            setSb(data.serviceSB);
        };
 
        // Step 3: merge into a single array, emailRow first     
 
      } catch (e: any) {
        console.error(e);
    //    setError(e.message || 'Unknown error');
      } finally {
   //     setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (() => {
      if( text != '' && time != '' && time != '' && selectedCaseId != -1)
            setTransferCaseDisable(false); 

      if( text == '' || time == '' || time == '' || selectedCaseId == -1)
            setTransferCaseDisable(true); 

     })();
  }, [text, time, selectedCaseId, abbrev, sb]);



  const setCaseHandler = async (id: string, name: string) => {
      console.log(id, name);
      setSelectedCaseName(name);
      setSelectedCaseId(Number.parseInt(id));
     // setTransferCaseDisable(false);
  }

  
  const sendEmailHandler = async () => 
  {
    console.log('Transfer to ADVOKAT, caseId =', selectedCaseName);
    console.log(sb, text,abbrev,time);

  
    const email = Office.context.mailbox.item;
    const messageId= await getInternetMessageIdAsync(email);

    const firstE = attachmentSelected.find(i => i.checked && i.type === 'E');//email taken
    var emailContent ='';
    if (firstE != null){
      emailContent = await getEmailContentAsync(email);
    }

    const attachmentsPayload = await mapToAttachments(attachmentSelected.filter(i => i.checked && i.type === 'A'));

    const payload : EmailModel  = firstE
    ? {
        caseId:       selectedCaseId,
        caseName:       selectedCaseName,
        serviceAbbreviationType:  abbrev.toString(),
        serviceSB:           sb,         
        serviceTime:         time,
        serviceText:         text,
        internetMessageId: messageId, //firstE.id??
        emailName:firstE.label,
        emailFolder: firstE.option.toString(),
        emailFolderId: firstE.option,
        emailContent: emailContent,
        attachments : attachmentsPayload,
        userID:'-1'

      }
    : {
        caseId:       selectedCaseId,
        caseName:       selectedCaseName,
        serviceAbbreviationType:   abbrev.toString(),
        serviceSB:           sb,         
        serviceTime:         time,
        serviceText:         text,
        internetMessageId: messageId,
        emailName:firstE.label,
        emailFolder:'-1',
        emailFolderId:-1,
        emailContent: emailContent,
        attachments : attachmentsPayload,
        userID:'-1'
      };
  
      const data = await saveEmailInformation(payload);
   
  };
 
 

  return (
    <div  >
      {/* 1) Panel wyszukiwania + lista spraw */}
      <SearchCaseList onCaseSelect={setCaseHandler} />
 
      {/* <DropAttachArea /> */}
 
 {/* 3) Sekcja Services */}
      <EmailSend
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
        oveerideDataOnStartup={true}
      />
 

      {/* 4) Transfer e-mail and attachments */}
      <TransferAndAttachment 
        onSelectionChange={setAttachmentSelected}
        caseId = {selectedCaseId}
      />
   
       {/* 5) Registered E-Mails */}
       <RegisteredEmails />

    </div>
  );
};

export default EmailTabContent;
