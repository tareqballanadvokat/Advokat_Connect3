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
import { saveEmailInformation, Attachment, getSavedEmailInfo  } from '../../../utils/api';

import {  getInternetMessageIdAsync } from '../../../hooks/useOfficeItem'; 
import DropAttachArea from '../shared/DropAttachArea';   // ← import it

async function mapToAttachments(
  items: TransferAttachmentItem[]
): Promise<Attachment[]> {
  // tylko te, które są zaznaczone
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
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedCaseDisable, setSelectedCaseDisable] = useState(false);
  const [abbrev, setAbbrev] = useState<number>(0);
  const [time, setTime]   = useState('');
  const [text, setText]   = useState('');
  const [sb, setSb]   = useState(''); 
  const [attachmentSelected, setAttachmentSelected] = useState<TransferAttachmentItem[]>([]);
  useEffect(() => {
    (async () => {
 
      try {
        // Step 1: Email informations
        const email = Office.context.mailbox.item;
        const messageId = await getInternetMessageIdAsync(email);
        // notify(
        //     {
        //         message: "You have a new message", 
        //         width: 230,
        //         position: {
        //             at: "bottom",
        //             my: "bottom",
        //             of: "#container"
        //         }
        //     }, 
        //     'error', 
        //     500
        // );
        // Step 2: fetch both emailRow & attachmentRows in one POST
        const data = await getSavedEmailInfo(messageId);
        if (data!= null)
        {
            setSelectedCase(data.caseId);
            setSelectedCaseDisable(true);
          //  setAbbrev(data.i);
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

  const sendEmailHandler = async () => {
    console.log('Transfer to ADVOKAT, caseId =', selectedCase);
    console.log(sb, text,abbrev,time);

  
  const email = Office.context.mailbox.item;
  const messageId= await getInternetMessageIdAsync(email);

  const firstE = attachmentSelected.find(i => i.checked && i.type === 'E');//email taken
  var emailContent ='';
  if (firstE != null){
    emailContent = await getEmailContentAsync(email);
  }

  const attachmentsPayload = await mapToAttachments(attachmentSelected.filter(i => i.checked && i.type === 'A'));


  const payload  = firstE
  ? {
      caseId:       selectedCase,
      serviceAbbreviationType:  abbrev.toString(),
      serviceSB:           sb,         
      serviceTime:         time,
      serviceText:         text,
      internetMessageId: messageId,
      emailName:firstE.name,
      emailFolder:firstE.option,
      emailContent: emailContent,
      attachments : attachmentsPayload

    }
  : {
      caseId:       selectedCase,
      serviceAbbreviationType:   abbrev.toString(),
      serviceSB:           sb,         
      serviceTime:         time,
      serviceText:         text,
      internetMessageId: messageId,
      emailName:firstE.name,
      emailFolder:'',
      emailContent: emailContent,
      attachments : attachmentsPayload
    };
 
    const data = await saveEmailInformation(payload);
   
  };
 
 

  return (
    <div  >
      {/* 1) Panel wyszukiwania + lista spraw */}
      <SearchCaseList onCaseSelect={setSelectedCase} />
 
      <DropAttachArea />
 
 {/* 3) Sekcja Services */}
      <EmailSend
        caseId={selectedCase}
        onCaseChange={setSelectedCase}
        onTransfer={sendEmailHandler}
        // abbreviation={abbrev}
        // sb={sb}
        // time={time}
        // text={text}
        caseIdDisable={selectedCaseDisable}
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
      />
   
       {/* 5) Registered E-Mails */}
       <RegisteredEmails />

    </div>
  );
};

export default EmailTabContent;
