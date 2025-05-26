// src/taskpane/components/tabs/cases/CasesAccordion.tsx
import React, { useState, useEffect, useCallback } from 'react';
import 'devextreme/dist/css/dx.light.css';
import SearchCaseList from './SearchCaseList';
import LoadPanel from 'devextreme-react/load-panel';
import TreeList, {
  Column,
  Scrolling,
  FilterRow,
  HeaderFilter,Editing,
  Paging,Button, type TreeListTypes,
  Pager,
  // Command column for buttons
 
} from 'devextreme-react/tree-list';

import { getMyFavoritesApi } from '../../../utils/api'; // your API

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


const allowDeleting = (e) => e.row.data.ID !== 1;
function allowDeletingVisible()
{
  return false;
} 

const onEditorPreparing = (e: TreeListTypes.EditorPreparingEvent) => {
  if (e.dataField === 'Head_ID' && e.row.data.ID === 1) {
    e.cancel = true;
  }
};

const onInitNewRow = (e: TreeListTypes.InitNewRowEvent) => {
  e.data.Head_ID = 1;
};


const CaseTabContent: React.FC = () => {
  const [nodes, setNodes]       = useState<HierarchyTree[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<number[]>([]);
  const [selectedCase, setSelectedCase] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getMyFavoritesApi(); // flatten list of folders & files
        setNodes(data);
        // auto-expand all top-level folders:
        const roots = data.filter(n => n.rootId == null).map(n => n.id);
        setExpandedKeys(roots);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSelectionChanged = useCallback((e) => {
    // keep expandedKeys in sync
    setExpandedKeys(e.component.getSelectedRowKeys());
  }, []);

  const handleOpen = useCallback((node: HierarchyTree) => {
    window.open(node.url, '_blank');
  }, []);

  const handleDelete = useCallback((id: number) => {
    // your delete logic...
    console.log('Remove favorite', id);
  }, []);

   return (
    <div /* … */>
      {/* … SearchCaseList, header, LoadPanel … */}

      <SearchCaseList onCaseSelect={setSelectedCase} />

      <TreeList
        dataSource={nodes}
        keyExpr="id"
        parentIdExpr="rootId"
        rootValue={-1}           // top‐level nodes have rootId = -1
        expandedRowKeys={expandedKeys}
        onExpandedRowKeysChange={setExpandedKeys}
        hasItemsExpr="hasChild"
        showRowLines={false}
        showBorders={false}
        columnAutoWidth
        wordWrapEnabled={false}
        height={400}
      >
        {/* … Paging, Scrolling … */}
      <Editing
        allowUpdating={false}
        allowDeleting={allowDeleting}
        allowAdding={false}
        mode="row" />
        <Column
          dataField="name"
          caption="Name"
          cellRender={({ data }: { data: HierarchyTree }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i
                className={
                  data.isStructure
                    ? 'dx-icon dx-icon-folder'
                    : 'dx-icon dx-icon-file'
                }
              />
              {data.name}
            </div>
          )}
        />
 

        {/* “Delete from favorite” on top‐level only */}
      <Column type="buttons">
        {/* <Button name="edit" /> */}
        <Button name="delete" visible={({ row }) => {
          return row.data.rootId === null;
        }}/>
        <Button name="open" visible={({ row }) => {
          return row.data.isStructure ===false;
        }}/>
          {/* <ColumnButton
       
            hint="Open"
            
           onCellClick={({ row }) => handleOpen(row.data)}
           visible={allowDeletingVisible()}
          /> */}
      </Column>
      </TreeList>
    </div>
  );
};
export default CaseTabContent;
