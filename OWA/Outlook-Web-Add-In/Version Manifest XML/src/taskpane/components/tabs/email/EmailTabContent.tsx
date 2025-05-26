// src/taskpane/components/tabs/email/EmailTabContent.tsx
import React, { useState, useEffect } from 'react';
import SearchAndCaseList from './SearchAndCaseList';
import Button from 'devextreme-react/button';
import EmailSend from './EmailSend'; 
import RegisteredEmails from './RegisteredEmails';  
import ServiceSection, { ServiceSectionProps } from '../shared/ServiceSection';
import { getEmailAttachmentData, getEmailContentAsync } from '../../../hooks/useOfficeItem';
import TransferAndAttachment, { TransferAttachmentItem, TransferEmailItem } from './TransferAndAttachment';
import { saveEmailInformation, Attachment, getSavedEmailInfo  } from '../../../utils/api';

import { useOfficeItem, getInternetMessageIdAsync, getEmailSubjectAsync, getEmailAttachments } from '../../../hooks/useOfficeItem'; 
 interface TransferPayload {
  attachments: TransferAttachmentItem[];
  emailBody: TransferEmailItem;
}

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

  // // jeśli na razie bez base64:
  // const results: Attachment[] = selected.map(i => ({
  //   id: i.id,
  //   originalFileName: i.label,
  //   fileName: i.label,
  //   contentBase64: '',
  //   folder: i.option
  // }));

  return results;
}

const EmailTabContent: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState('');
  const [abbrev, setAbbrev] = useState('');
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
 
        // Step 2: fetch both emailRow & attachmentRows in one POST
        const data = await getSavedEmailInfo(messageId);
        if (data!= null)
        {
         
      //      setAbbrev(data.serviceAbbreviationType);
            // setText(data.serviceText);
            // setTime(data.serviceTime);
            // setSb(data.serviceSB);
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

  
    //  // build attachments payload from selected checkboxes
    //  const attachmentsPayload = attachmentSelected.map(a => ({
    //   id: a.id,
    //   // if you need to send the label as filename, rename accordingly:
    //    fileName: a.label
    // }));
    
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
onSelectionChange={setAttachmentSelected}
      />
   
       {/* 5) Registered E-Mails */}
       <RegisteredEmails />

    </div>
  );
};

export default EmailTabContent;
