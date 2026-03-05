// src/taskpane/hooks/useOfficeItem.ts
import { useState, useEffect } from 'react';
import { getLogger } from '@services/logger';

const logger = getLogger();

// Typ dla załączników
export interface AttachmentInfo {
  id: string;
  name: string;
}

type OfficeItem = typeof Office.context.mailbox.item;


export function IsComposeMode(): boolean {
 const item = Office.context.mailbox.item
  return (
    item.itemType === Office.MailboxEnums.ItemType.Message &&
    typeof (item as any).body.getTypeAsync === 'function'
  );
}

/** Sprawdza, czy jesteśmy w Compose mode */
export function isComposeMode(item: OfficeItem): boolean {
  return (
    item.itemType === Office.MailboxEnums.ItemType.Message &&
    typeof (item as any).body.getTypeAsync === 'function'
  );
}

export function getEmailSubjectAsync(): Promise<string> {
  if (!isComposeMode(Office.context.mailbox.item)) {
    return Promise.resolve(Office.context.mailbox.item.subject);
  }
  return new Promise((resolve, reject) => {
    Office.context.mailbox.item.subject.getAsync(res => {
      if (res.status === Office.AsyncResultStatus.Succeeded) resolve(res.value);
      else reject(new Error(res.error.message));
    });
  });
}

/** Gets Message-ID from headers */
function getInternetMessageId(item: OfficeItem): Promise<string> {
  return new Promise((resolve, reject) => {
    item.getAllInternetHeadersAsync(res => {
      if (res.status === Office.AsyncResultStatus.Succeeded) {
        const match = (res.value as string).match(/Message-ID:\s*(.+)/i);
        if (match) resolve(match[1].trim());
        else reject(new Error('No Message-ID header found.'));
      } else {
        reject(new Error(res.error.message));
      }
    });
  });
}

export function getInternetMessageIdAsync(item: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const isCompose = typeof item.body.setAsync === "function";
    logger.debug('getInternetMessageIdAsync - isCompose: ' + isCompose, 'useOfficeItem');

    if (isCompose) {
      // Compose mode – use itemId as temporary unique identifier
      logger.debug('In compose mode, getting itemId...', 'useOfficeItem');
      item.getItemIdAsync((res: Office.AsyncResult<string>) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          logger.debug('Compose mode itemId: ' + res.value, 'useOfficeItem');
          resolve(res.value);
        } else {
          logger.error('Failed to get itemId in compose mode: ' + res.error.message, 'useOfficeItem');
          reject(new Error("Failed to get itemId in compose mode: " + res.error.message));
        }
      });
    } else {
      // Read mode – use the internetMessageId property directly
      logger.debug('In read mode, getting internetMessageId property...', 'useOfficeItem');
      
      // Check if internetMessageId property is available (it's synchronous in read mode)
      if (item.internetMessageId) {
        let messageId = item.internetMessageId;
        // Remove angle brackets if present (Message-ID is often wrapped in <>)
        messageId = messageId.replace(/^<|>$/g, '');
        logger.debug('internetMessageId from property: ' + messageId, 'useOfficeItem');
        resolve(messageId);
      } else {
        // Fallback to parsing headers if internetMessageId is not available
        logger.warn('internetMessageId property not available, falling back to headers...', 'useOfficeItem');
        item.getAllInternetHeadersAsync((res: Office.AsyncResult<string>) => {
          if (res.status === Office.AsyncResultStatus.Succeeded) {
            logger.debug('Raw headers received (first 500 chars): ' + res.value.substring(0, 500), 'useOfficeItem');
            // Match Message-ID header value, stopping at newline or carriage return
            const match = res.value.match(/Message-ID:\s*([^\r\n]+)/i);
            if (match) {
              logger.debug('Message-ID matched from headers: ' + match[1], 'useOfficeItem');
              // Remove angle brackets if present
              let messageId = match[1].trim();
              messageId = messageId.replace(/^<|>$/g, '');
              logger.debug('Final messageId (after cleanup): ' + messageId, 'useOfficeItem');
              resolve(messageId);
            } else {
              logger.error('Missing Message-ID header', 'useOfficeItem');
              reject(new Error("Missing Message-ID header."));
            }
          } else {
            logger.error('Error downloading headers: ' + res.error.message, 'useOfficeItem');
            reject(new Error("Error downloading headers: " + res.error.message));
          }
        });
      }
    }
  });
}

/** Zwraca listę {id,name} dla wszystkich załączników */
export function getEmailAttachments(item: OfficeItem): Promise<AttachmentInfo[]> {
  return new Promise(resolve => {
    // attachments jest od razu dostępne w obu trybach
    const list = (item.attachments || []).map(att => ({
      id: att.id,
      name: att.name
    }));
    resolve(list);
  });
}

/** Zwraca listę {id,name} dla wszystkich załączników */
export function getEmailAttachmentData(id: string): Promise<string> {
      return new Promise((resolve) => {
        Office.context.mailbox.item.getAttachmentContentAsync(id, (res) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          resolve(res.value.content);
        }
        });
    });
}

/** Pobiera ciało e-maila jako plik/text (lub cokolwiek zwraca API) */
export function getEmailContentAsync(item: OfficeItem): Promise<any> {
  return new Promise((resolve, reject) => {
    // przykładowo getAsFileAsync, dostosuj do własnych potrzeb
    (item as any).getAsFileAsync((res: any) => {
      if (res.status === Office.AsyncResultStatus.Succeeded) resolve(res.value);
      else reject(new Error(res.error.message));
    });
  });
}

/** Pobiera ciało e-maila jako plik/text (lub cokolwiek zwraca API) */
export async function setAttachmentToItemAsync(base64: string, fileName: string ): Promise<any> {
         // 2) Attach to current message (Compose mode)
       
        await new Promise<void>((resolve, reject) => {
          Office.context.mailbox.item.addFileAttachmentFromBase64Async(
             base64, 
            
              fileName,
         
            { isInline: false },
            result => {
              if (result.status === Office.AsyncResultStatus.Succeeded){ resolve();}
              else{ 
                logger.error('Failed to add attachment', 'useOfficeItem', result);
                reject(result.error);}
            }
          );
        });
    }
/**
 * Hook zwraca:
 *  - subject
 *  - messageId
 *  - attachments[]
 *  - emailContent
 *  - composeMode
 *  - ready (czy wszystkie powyższe już się załadowały)
 */
export function useOfficeItem() {
  const [subject,      setSubject]      = useState<string>('');
  const [messageId,    setMessageId]    = useState<string>('');
  const [attachments,  setAttachments]  = useState<AttachmentInfo[]>([]);
  const [emailContent, setEmailContent] = useState<any>(null);
  const [composeMode,  setComposeMode]  = useState<boolean>(false);
  const [ready,        setReady]        = useState<boolean>(false);

  // 1) Uruchamiamy wszystkie wywołania Office.js
  useEffect(() => {
    const item = Office.context.mailbox.item;
    setComposeMode(isComposeMode(item));

    getEmailSubjectAsync()
      .then(setSubject)
      .catch(err => logger.error('Subject error:', 'useOfficeItem', err));

    getInternetMessageId(item)
      .then(setMessageId)
      .catch(err => logger.error('Message-ID error:', 'useOfficeItem', err));

    getEmailAttachments(item)
      .then(setAttachments)
      .catch(err => logger.error('Attachments error:', 'useOfficeItem', err));

    getEmailContentAsync(item)
      .then(setEmailContent)
      .catch(err => logger.error('Email content error:', 'useOfficeItem', err));
  }, []);

  // 2) Once all four values ​​are set, we turn on ready
  useEffect(() => {
    if (
      subject !== '' &&
      messageId !== '' &&
      attachments !== null &&
      emailContent !== null
    ) {
      setReady(true);
    }
  }, [subject, messageId, attachments, emailContent]);

  return {
    subject,
    messageId,
    attachments,
    emailContent,
    composeMode,
    ready
  };
}
