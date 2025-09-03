import { API_BASE } from '../../config';
import { EmailModel } from '../components/interfaces/IEmail';
import { HierarchyTree } from '../components/interfaces/ICase';
import notify from 'devextreme/ui/notify';

// Re-export interfaces for backward compatibility (can be removed later)
export type { EmailModel, HierarchyTree };

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
  return data;
}