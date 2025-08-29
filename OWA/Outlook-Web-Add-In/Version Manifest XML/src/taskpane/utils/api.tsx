import { API_BASE } from '../../config';
import { CaseItem } from '../components/interfaces/ISearchCase';
import { Person } from '../components/interfaces/IPerson';
import { EmailModel, Attachment } from '../components/interfaces/IEmail';
import { Abbreviation, TransferData } from '../components/interfaces/ICommon';
import { HierarchyTree } from '../components/interfaces/ICase';
import notify from 'devextreme/ui/notify';

// Re-export interfaces for backward compatibility (can be removed later)
export type { EmailModel, Attachment, Abbreviation, TransferData, HierarchyTree };

export async  function   addCases(id) {
  console.log("node Id", id);
  const resp = await fetch(API_BASE+'api/favorite/add', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ nodeId: 100 })
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