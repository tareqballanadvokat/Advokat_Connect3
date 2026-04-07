// Case-related interfaces and models

export interface HierarchyTree {
  id: number;
  name: string;
  rootId?: number | null;
  hasChild: boolean;
  causa: string;
  hasUrl: boolean;
  url: string;
  isStructure: boolean;
  documentId?: number; // Add this to store the actual document ID from database
}
 