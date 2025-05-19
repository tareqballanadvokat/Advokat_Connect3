import { useState, useEffect } from 'react';

type OfficeItem = typeof Office.context.mailbox.item;


// Typy dla zwracanych obiektów
export interface AttachmentInfo {
  id: string;
  name: string;
}


/** Returns promise for the current message’s subject. */
async function getEmailSubject(): Promise<string> {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.item.subject.getAsync(result => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(result.error.message));
      }
    });
  });
}
 
/**
 * Zwraca listę obiektów { id, name } dla wszystkich załączników bieżącej wiadomości.
 * Działa zarówno w trybie Compose, jak i Read.
 */
async function calculateAttachments(
  item: OfficeItem
): Promise<AttachmentInfo[]> {
  // Jeżeli w Compose Mode, attachments też dostępne jako item.attachments
  if (isComposeMode(item)) {
    const composeItem = item ;
    return (composeItem.attachments || []).map(att => ({
      id: att.id,
      name: att.name
    }));
  } else {
    // Tryb odczytu
    const readItem = item ;
    return (readItem.attachments || []).map(att => ({
      id: att.id,
      name: att.name
    }));
  }
}

/** Returns promise for the current message’s Internet-Message-ID header. */
async function getInternetMessageId(item: OfficeItem): Promise<string> {
  return new Promise((resolve, reject) => {
    item.getAllInternetHeadersAsync(headersResult => {
      if (headersResult.status === Office.AsyncResultStatus.Succeeded) {
        const match = (headersResult.value as string).match(/Message-ID: (.+)/i);
        if (match) resolve(match[1].trim());
        else reject(new Error('No Message-ID found in headers.'));
      } else {
        reject(new Error(headersResult.error.message));
      }
    });
  });
}

/** True if we are composing a new mail (vs. read-only). */
function isComposeMode(item: OfficeItem): boolean {
  return (
    item.itemType === Office.MailboxEnums.ItemType.Message &&
    typeof (item as any).body.getTypeAsync === 'function'
  );
}


async function getEmailContentAsync(item) {
    return new Promise((resolve, reject) => {

       item.getAsFileAsync(  (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
            resolve( asyncResult.value)
          } else {
            reject(asyncResult.error.message);
          }
        });
    });
}

/** React hook exposes subject, messageId and compose/read mode. */
export function useOfficeItem() {
  const [subject, setSubject]               = useState<string>('');
  const [messageId, setMessageId]           = useState<string>('');
  const [emailContent, setEmailContent]     = useState<string>('');
  const [composeMode, setCompose]           = useState<boolean>(false);
  const [itemAttachments, setAttachments]   = useState<AttachmentInfo[]>([]);

  useEffect(() => {
    const item = Office.context.mailbox.item;
    setCompose(isComposeMode(item));

    // fire off both calls in parallel
    getEmailSubject()
      .then(setSubject)
      .catch(err => console.error('subject error:', err));

    getInternetMessageId(item)
      .then(setMessageId)
      .catch(err => console.error('messageId error:', err));

      calculateAttachments(item)
      .then(setAttachments)
      .catch(err => console.error('attachments error:', err));

      
      getEmailContentAsync(item)
      .then(setEmailContent)
      .catch(err => console.error('email content:', err));
  }, []);

  return { subject, messageId, composeMode, itemAttachments, emailContent };
}
