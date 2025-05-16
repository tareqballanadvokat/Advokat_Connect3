// src/taskpane/components/tabs/email/SearchAndCaseList.tsx
import React, { useState, useEffect } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { API_BASE } from '../../../../config';
interface CaseItem {
  caseId: string;
  causa: string;
  name: string;
}

interface Props {
  onCaseSelect: (caseId: string) => void;
}

const SearchAndCaseList: React.FC<Props> = ({ onCaseSelect }) => {
  const [searchValue, setSearchValue] = useState('');
  const [rows, setRows] = useState<CaseItem[]>([]);
  const [fullData, setFullData] = useState<CaseItem[]>([]);

  useEffect(() => {
    // fetch initial data
    (async () => {
      try {
        const resp = await fetch(API_BASE+'api/structure/search-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '' })   // lub inny payload
        });
        const data: CaseItem[] = await resp.json();
        setFullData(data);
        setRows(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleSearch = async () => {
    const filter = searchValue.trim().toLowerCase();
    if (!filter) {
      setRows(fullData);
    } else {
      setRows(
        fullData.filter(
          item =>
            item.name.toLowerCase().includes(filter) 
          //||  item.causa.toLowerCase().includes(filter),
        ),
      );
    }
  };

  return (
    <div>
      {/* Search panel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextBox 
          stylingMode="outlined"
          placeholder="Search..."
          value={searchValue}
          onValueChanged={e => setSearchValue(e.value)}
          onEnterKey={handleSearch}
        />
        <Button icon="search" stylingMode="contained" onClick={handleSearch} />
      </div>

      {/* Case list with pagination */}
      <DataGrid
        dataSource={rows}
        keyExpr="id"
        showBorders={false}
        showRowLines
        columnAutoWidth 
      >
        <Paging defaultPageSize={1} />
        <Pager visible showPageSizeSelector={false} allowedPageSizes={[1]} showInfo />
        <Column alignment='left' visible={false} dataField="id" caption="Case ID" />
        <Column dataField="name" caption="Name" />
        <Column dataField="causa" caption="Causa" />
        <Column
          caption=""
          width={80}
          cellRender={({ data }) => (
            <Button
              icon="arrowright"
              stylingMode="text"
              hint="Select"
              onClick={
                () => {console.log('Open case', data.name),
            onCaseSelect(data.name)}
              }
            />
          )}
        />
      </DataGrid>
    </div>
  );
};

export default SearchAndCaseList;
