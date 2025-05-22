// import React from 'react';

// const CaseTabContent: React.FC = () => {
//   return (
//     <div style={{ padding: 16 }}>
//       <h4>E-Mail</h4>
//       <p>Tu wstaw formularz lub listę e-maili.</p>
//     </div>
//   );
// };

// export default CaseTabContent;



// src/taskpane/components/tabs/structure/HierarchyTreeView.tsx
import React, { useState, useEffect } from 'react';
import 'devextreme/dist/css/dx.light.css';
import TreeList, {
  Column,
  Scrolling,
  Paging,
  FilterRow,
  HeaderFilter
} from 'devextreme-react/tree-list';
import { getMyFavoritesApi } from   '../../../utils/api';

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

const CaseTabContent: React.FC = () => {
  const [data, setData] = useState<HierarchyTree[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await getMyFavoritesApi();
        setData(list);
      } catch (err) {
        console.error('Error loading hierarchy:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div>Loading structure…</div>;
  }

  return (
    // <TreeList
    //   dataSource={data}
    //      keyExpr="id" 
    //   parentIdExpr="rootId"
    //   showRowLines={true}
    //   showBorders={true}
    //   columnAutoWidth={true}
    //   wordWrapEnabled={true}
    //   defaultExpandedRowKeys={data.filter(d => d.rootId == null).map(d => d.id)}
 
    //   aria-label="Hierarchy Tree"
    // >
    //   <Paging enabled={false} />
    //   <Scrolling mode="virtual" />
    //   <FilterRow visible={true} />
    //   <HeaderFilter visible={true} />

    //   {/* Name column */}
    //   <Column
    //     dataField="name"
    //     caption="Name"
    //   />

    //   {/* Causa */}
    //   <Column
    //     dataField="causa"
    //     caption="Causa"
    //   />

    //   {/* URL as link */}
    //   <Column
    //     caption="Link"
    //     cellRender={({ data }: { data: HierarchyTree }) =>
    //       data.hasUrl && data.url
    //         ? <a href={data.url} target="_blank" rel="noopener noreferrer">{data.url}</a>
    //         : null
    //     }
    //   />
    // </TreeList>


     <TreeList 
    dataSource={data}
    rootValue={-1}
    //defaultExpandedRowKeys={expandedRowKeys}
    showRowLines={true}
    showBorders={true}
    columnAutoWidth={true}
    keyExpr="id"
    parentIdExpr="rootId"
  >
    <Column
      dataField="id"
      caption="Position" />
    <Column
      dataField="name" />
    <Column
      dataField="causa" />
    {/* <Column
      dataField="State" />
    <Column
      dataField="Mobile_Phone" />
    <Column
      dataField="Hire_Date"
      dataType="date" /> */}
  </TreeList>
  );
};

export default CaseTabContent;
