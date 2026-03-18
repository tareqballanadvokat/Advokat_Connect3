// src/taskpane/hooks/useOfficeItem.ts
import { useState, useEffect } from 'react';
import { getLogger } from '@infra/logger';

const logger = getLogger();

// Typ dla zalacznik�w
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

/** Sprawdza, czy jestesmy w Compose mode */
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

/** Gets Message-ID from item property (available since Mailbox 1.1 in read mode) */
function getInternetMessageId(item: OfficeItem): Promise<string> {
  return new Promise((resolve, reject) => {
    const msgId = (item as any).internetMessageId as string | undefined;
    if (msgId) {
      resolve(msgId.replace(/^<|>$/g, ''));
    } else {
      reject(new Error('internetMessageId not available on this item.'));
    }
  });
}

export function getInternetMessageIdAsync(item: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const isCompose = typeof item.body.setAsync === "function";
    logger.debug('getInternetMessageIdAsync - isCompose: ' + isCompose, 'useOfficeItem');

    if (isCompose) {
      // Compose mode: getItemIdAsync requires Mailbox 1.8; use it if available, else generate a session-scoped ID
      logger.debug('In compose mode, getting itemId...', 'useOfficeItem');
      if (typeof item.getItemIdAsync === 'function') {
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
        // Mailbox < 1.8 fallback: generate a stable temporary ID for this compose session
        const storageKey = 'advokat_compose_temp_id';
        let tempId = sessionStorage.getItem(storageKey);
        if (!tempId) {
          tempId = 'compose-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
          sessionStorage.setItem(storageKey, tempId);
        }
        logger.debug('Compose mode fallback tempId: ' + tempId, 'useOfficeItem');
        resolve(tempId);
      }
    } else {
      // Read mode � use the internetMessageId property directly
      logger.debug('In read mode, getting internetMessageId property...', 'useOfficeItem');
      
      // Check if internetMessageId property is available (it's synchronous in read mode)
      if (item.internetMessageId) {
        let messageId = item.internetMessageId;
        // Remove angle brackets if present (Message-ID is often wrapped in <>)
        messageId = messageId.replace(/^<|>$/g, '');
        logger.debug('internetMessageId from property: ' + messageId, 'useOfficeItem');
        resolve(messageId);
      } else {
        // internetMessageId is available since Mailbox 1.1 in read mode; if absent the environment is unsupported
        logger.error('internetMessageId property not available — Outlook version may be too old.', 'useOfficeItem');
        reject(new Error('internetMessageId is not available on this item.'));
      }
    }
  });
}

/** Zwraca liste {id,name} dla wszystkich zalacznik�w */
export function getEmailAttachments(item: OfficeItem): Promise<AttachmentInfo[]> {
  return new Promise(resolve => {
    // attachments jest od razu dostepne w obu trybach
    const list = (item.attachments || []).map(att => ({
      id: att.id,
      name: att.name
    }));
    resolve(list);
  });
}

/** Zwraca liste {id,name} dla wszystkich zalacznik�w */
export function getEmailAttachmentData(id: string): Promise<string> {
      return new Promise((resolve) => {
        Office.context.mailbox.item.getAttachmentContentAsync(id, (res) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          resolve(res.value.content);
        }
        });
    });
}

/** Returns the email body as an HTML string (Mailbox 1.1+) */
export function getEmailContentAsync(item: OfficeItem): Promise<string> {
  return new Promise((resolve, reject) => {
    item.body.getAsync(Office.CoercionType.Html, res => {
      if (res.status === Office.AsyncResultStatus.Succeeded) resolve(res.value);
      else reject(new Error(res.error.message));
    });
  });
}

/** Pobiera cialo e-maila jako plik/text (lub cokolwiek zwraca API) */
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
 *  - ready (czy wszystkie powyzsze juz sie zaladowaly)
 */
export function useOfficeItem() {
  const [subject,      setSubject]      = useState<string>('');
  const [messageId,    setMessageId]    = useState<string>('');
  const [attachments,  setAttachments]  = useState<AttachmentInfo[]>([]);
  const [emailContent, setEmailContent] = useState<any>(null);
  const [composeMode,  setComposeMode]  = useState<boolean>(false);
  const [ready,        setReady]        = useState<boolean>(false);

  // 1) Uruchamiamy wszystkie wywolania Office.js
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

  // 2) Once all four values ??are set, we turn on ready
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
