// src/taskpane/hooks/useOfficeItem.ts
import { useState, useEffect } from 'react';

// Typ dla załączników
export interface AttachmentInfo {
  id: string;
  name: string;
}
// export interface Attachment
// {
//    id :string;
//    originalFileName  :string;
//    fileName  :string;
//    contentBase64  :string;
//    folder  :number;
// } 
// OfficeItem alias
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

/** Pobiera temat wiadomości */
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

/** Pobiera Message-ID z nagłówków */
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

    if (isCompose) {
      // Compose mode – trzeba pobrać itemId asynchronicznie
      item.getItemIdAsync((res: Office.AsyncResult<string>) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          resolve(res.value); // Tymczasowe ID, unikalne w tej sesji
        } else {
          reject(new Error("Nie udało się pobrać itemId w compose mode: " + res.error.message));
        }
      });
    } else {
      // Read mode – można użyć internetMessageId z nagłówków
      item.getAllInternetHeadersAsync((res: Office.AsyncResult<string>) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          const match = res.value.match(/Message-ID:\s*(.+)/i);
          if (match) {
            resolve(match[1].trim());
          } else {
            reject(new Error("Brak nagłówka Message-ID."));
          }
        } else {
          reject(new Error("Błąd pobierania nagłówków: " + res.error.message));
        }
      });
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
                console.log(result);
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
      .catch(err => console.error('Subject error:', err));

    getInternetMessageId(item)
      .then(setMessageId)
      .catch(err => console.error('Message-ID error:', err));

    getEmailAttachments(item)
      .then(setAttachments)
      .catch(err => console.error('Attachments error:', err));

    getEmailContentAsync(item)
      .then(setEmailContent)
      .catch(err => console.error('Email content error:', err));
  }, []);

  // 2) Gdy wszystkie cztery wartości są ustawione, włączamy ready
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
