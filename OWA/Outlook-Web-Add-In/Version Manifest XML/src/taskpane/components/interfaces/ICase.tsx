 export interface HierarchyTree {
   id: number;
   name: string;
   rootId?: number | null;
   hasChild: boolean;
   causa: string;
   hasUrl: boolean;
   url: string;
   isStructure: boolean;
 }
 