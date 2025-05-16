// src/taskpane/components/tabs/email/SearchAndCaseList.tsx
import React, { useState } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column } from 'devextreme-react/data-grid';

interface CaseItem {
  caseId: string;
  causa: string;
}

const initialData: CaseItem[] = [
  { caseId: 'ADVOKAT/TEST',  causa: 'Contract' },
  { caseId: 'ADVOKAT/TEST2', causa: 'M&A'      },
];

const SearchAndCaseList: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [rows, setRows] = useState<CaseItem[]>(initialData);

  const handleSearch = () => {
    const filter = searchValue.trim().toLowerCase();
    if (!filter) {
      setRows(initialData);
    } else {
      setRows(
        initialData.filter(
          item =>
            item.caseId.toLowerCase().includes(filter) ||
            item.causa.toLowerCase().includes(filter),
        ),
      );
    }
  };

  return (
    <div>
      {/* --- Search panel --- */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <TextBox
          width={250}
          stylingMode="outlined"
          placeholder="Search..."
          value={searchValue}
          onValueChanged={e => setSearchValue(e.value)}
        />
        <Button
          icon="search"
          stylingMode="contained"
          type="default"
          onClick={handleSearch}
        />
      </div>

      {/* --- Case list --- */}
      <DataGrid
        dataSource={rows}
        showBorders={false}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText="No cases found"
        height={200}
      >
        <Column dataField="caseId" caption="Case ID" />
        <Column dataField="causa"  caption="Causa" />
        <Column
          caption=""
          width={80}
          cellRender={({ data }) => (
            <Button
              icon="arrowright"
              stylingMode="text"
              hint="Open"
              onClick={() => console.log('Open case', data.caseId)}
            />
          )}
        />
      </DataGrid>
    </div>
  );
};

export default SearchAndCaseList;
