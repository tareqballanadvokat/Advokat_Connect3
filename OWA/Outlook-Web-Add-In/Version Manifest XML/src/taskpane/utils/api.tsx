// import { AttachmentInfo } from './calculateAttachments';
import { TransferAttachmentItem, TransferEmailItem } from '../components/tabs/email/TransferAndAttachment';
import { API_BASE } from '../../config';
import {CaseItem} from '../components/interfaces/ISearchCase'
import {Person} from '../components/interfaces/IPerson'

import notify from 'devextreme/ui/notify'; // ← import DevExtreme notify
export interface TransferData {
  emailRow: TransferEmailItem;
  attachmentRows: TransferAttachmentItem[];
}

export interface EmailModel {
  caseId  :number;
  caseName  :string;
  serviceAbbreviationType  :string;
  serviceSB  :string;
  serviceTime :string;
  serviceText  :string;
  internetMessageId :string;
  emailName  :string;
  emailContent :string;
  emailFolder  :string;
  emailFolderId  :number;
    userID  :string;
    attachments: Attachment[] | [];
}

export interface Attachment
{
   id :string;
   originalFileName  :string;
   fileName  :string;
   contentBase64  :string;
   folder  :number;
} 

 
export interface HierarchyTree {
  id: number;
  name: string;
  rootId?: number | null;
  hasChild: boolean;
  isStructure: boolean;
  causa: string;
  hasUrl: boolean;
  url: string; 
}

export interface  Abbreviation
{
        id :number;
        name: string;
}

export async function saveEmailInformation(payload: EmailModel)
{
      const response = await fetch(
        API_BASE+'api/email/add-to-advocat', 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
         body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        notify('Saving email failed', 'error', 5000);
        // np. 400 / 500
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Transfer successful:', result);
};


export async function saveServiceInformation(payload: any)
{
      const response = await fetch(
        API_BASE+'api/service/add-service', 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
         body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        notify('Saving email failed', 'error', 5000);
        // np. 400 / 500
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Transfer successful:', result);
};

export async function getSavedEmailInfo(
  messageId: string
): Promise<EmailModel> {
  const resp = await fetch(API_BASE+'api/email/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: messageId })
  });

  if (!resp.ok) {
    notify('Retriving saved email failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }

  // API zwraca PascalCase – mapujemy na camelCase
  const raw = (await resp.json()) as any;
  if (raw == null) return null;
  const model: EmailModel = {
    caseId: raw.caseId ?? raw.caseId,
    caseName: raw.caseName ?? raw.caseName,
    serviceAbbreviationType: raw.serviceAbbreviationType ?? raw.serviceAbbreviationType,
    serviceSB: raw.serviceSB ?? raw.serviceSB,
    serviceTime: raw.serviceTime ?? raw.serviceTime,
    serviceText: raw.serviceText ?? raw.serviceText,
    internetMessageId: raw.internetMessageId ?? raw.internetMessageId,
    emailName: raw.emailName ?? raw.emailName,
    emailContent: raw.emailContent ?? raw.emailContent,
    emailFolder: raw.emailFolder ?? raw.emailFolder,
    emailFolderId: raw.emailFolderId ?? raw.emailFolderId,
    userID: raw.userID ?? raw.userID,
    attachments: Array.isArray(raw.attachments ?? raw.attachments)
      ? ( (raw.attachments ?? raw.attachments) as any[] ).map(att => ({
          id: att.id ?? att.id,
          originalFileName: att.OriginalFileName ?? att.originalFileName,
          fileName: att.fileName ?? att.fileName,
          contentBase64: att.contentBase64 ?? att.contentBase64,
          folder: att.folder ?? att.folder
        }) as Attachment)
      : []
  };

  return model;
}


export async function getStructureFolderByIdApi(id: number): Promise<HierarchyTree[]> {
 
  const resp = await fetch(API_BASE+'api/react-structure/get-structure-by-id', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    } ,    body: JSON.stringify({ id: id })
  });

  if (!resp.ok) {
    notify('Retriving structure failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }

  // JSON from .NET will have PascalCase keys, so map them to our camelCase interface
  const data = (await resp.json()) as any[];
  return data.map(item => ({
    id:          item.id,
    name:        item.name,
    rootId:      item.rootId ?? null,
    hasChild:    item.hasChild,
    isStructure: item.isStructure,
    causa:       item.causa,
    hasUrl:      item.hasUrl,
    url:         item.url
  }));
 
}


export async function getStructureFolderApi(): Promise<HierarchyTree[]> {
  const resp = await fetch(API_BASE+'api/structure/get-structure', {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!resp.ok) {
    notify('Retriving case structure failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }

  // JSON from .NET will have PascalCase keys, so map them to our camelCase interface
  const data = (await resp.json()) as any[];
  return data.map(item => ({
    id:          item.id,
    name:        item.name,
    rootId:      item.rootId ?? null,
    hasChild:    item.hasChild,
    isStructure: item.isStructure,
    causa:       item.causa,
    hasUrl:      item.hasUrl,
    url:         item.url
  }));
 
}


export async function getMyFavoritesApi(): Promise<HierarchyTree[]> {
  const resp = await fetch(API_BASE+'api/favorite/get-my-favorites', {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!resp.ok) {
    notify('Retriving My-Favorites list failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }

  // JSON from .NET will have PascalCase keys, so map them to our camelCase interface
  const data = (await resp.json()) as any[];
  return data.map(item => ({
    id:          item.id,
    name:        item.name,
    rootId:      item.rootId ?? null,
    hasChild:    item.hasChild,
    isStructure: item.isStructure,
    causa:       item.causa,
    hasUrl:      item.hasUrl,
    url:         item.url
  }));
 
}


export async function getAbbreviationByIdApi(id: number): Promise<Abbreviation[]> 
{ 
 const resp = await fetch(API_BASE+'api/abbreviation/get-abbreviation', {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id: id })
  });
   
  if (!resp.ok) {
    notify('Retriving abbreviation dictionary failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }

  // The .NET API returns PascalCase objects, e.g. { Id, Name }
  const raw = (await resp.json()) as Array<{ id: number; name: string }>;
 
  // Map to our camelCase interface
  const data = raw.map(item => ({
    id:   item.id,
    name: item.name
  }));
  return data;
}


export async function getAbbreviationApi(): Promise<Abbreviation[]> 
{ 
 const resp = await fetch(API_BASE+'api/abbreviation/get-abbreviation', {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });
   
  if (!resp.ok) {
    notify('Retriving abbreviation dictionary failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }

  // The .NET API returns PascalCase objects, e.g. { Id, Name }
  const raw = (await resp.json()) as Array<{ id: number; name: string }>;
 
  // Map to our camelCase interface
  const data = raw.map(item => ({
    id:   item.id,
    name: item.name
  }));
  return data;
}

 export async function getPersonApi(): Promise<Person[]> 
 { 
 const resp = await fetch(API_BASE+'api/person/get', {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });
   
  if (!resp.ok) {
    notify('Retriving person failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }

  // The .NET API returns PascalCase objects, e.g. { Id, Name }
  const raw = (await resp.json()) as any;// Array<{ id: number; name: string }>;
 
  // Map to our camelCase interface
  const data = raw.map(item => ({
    id:   item.id,
    fullName: item.fullName,
    address: item.address,
    phone: item.phone,
     email:item.email,
     website: item.webSite,
      city:item.city
  }));
  return data;
}

 


export async  function   addPerson(id) {
  const resp = await fetch(API_BASE+'api/person/add', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id: id })
  });
     if (!resp.ok) {
    notify('Add person failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }
 
}

export async  function   addCases(id) {
  const resp = await fetch(API_BASE+'api/favorite/add', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ nodeId: id })
  });
  if (!resp.ok) {
    notify('Add case to favorites failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }
 
}
export async function removeCases(personId) 
{    
      const resp = await  fetch(API_BASE+'api/favorite/delete', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nodeId: personId })
      });
     if (!resp.ok) {
      
        notify('Removed case from favorites failed', 'error', 5000);
        const txt = await resp.text();
        throw new Error(`API error ${resp.status}: ${txt}`);
      } 
}
 
 
export async function removePerson(personId) 
{    
      const resp = await  fetch(API_BASE+'api/person/delete', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nodeId: personId })
      });
    if (!resp.ok) 
    {
        
      notify('Delete person failed', 'error', 5000);
      const txt = await resp.text();
      throw new Error(`API error ${resp.status}: ${txt}`);
    } 
}
 
 

export async function getCases(searchValue:string): Promise<CaseItem[]> 
{ 
// const resp = await fetch(API_BASE+'api/react-structure/search-cases', {
  const resp = await fetch(API_BASE+'api/react-structure/search-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchValue })   // lub inny payload
        });
  const data: CaseItem[] = await resp.json();
   
  if (!resp.ok) {
    notify('Search cases failed', 'error', 5000);
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  } 
  // Map to our camelCase interface
 
  return data;
}

export async function getFileContent(nodeId:number) :Promise<string> {
  const resp = await fetch(API_BASE+'api/react-structure/get-file-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: nodeId.toString() })   // lub inny payload
        });
  const data: string = await resp.json();
   
  if (!resp.ok) 
  {
    const txt = await resp.text();
    notify('Get file content failed', 'error', 5000);
    throw new Error(`API error ${resp.status}: ${txt}`);
  } 
  // Map to our camelCase interface
 
  return data;
}