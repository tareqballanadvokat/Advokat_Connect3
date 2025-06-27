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
        const resp = await fetch(API_BASE+'api/react-structure/search-cases', {
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
      <h3 style={{ width:'220px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        Search 
      </h3>

      {/* Search panel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextBox
          width={250}
          stylingMode="outlined"
          placeholder="Search..."
          value={searchValue}
          onValueChanged={e => setSearchValue(e.value)}
          onEnterKey={handleSearch}
        />
        <Button icon="search" stylingMode="contained" onClick={handleSearch} />
      </div>
    {/* … Twój panel wyszukiwania … */}

    <DataGrid
      className="compact-grid"
      dataSource={rows}
      keyExpr="id"               // Twój klucz
      showBorders={false}
   
      showColumnLines={false}
      showRowLines={true}
      columnAutoWidth={true}
      rowAlternationEnabled={false}
      
    >
      <Paging defaultPageSize={5} />
      <Pager
        visible
        showPageSizeSelector={false}
        allowedPageSizes={[5]}
        showInfo
      />
      {/* -------------------------------- */}
      <Column
        dataField="id"
        caption="Case ID"
        visible={false}         // ukryte, ale dalej dostępne
        alignment="left"
      />
      <Column
        dataField="name"
        caption="Name"
        alignment="left"
      />
      <Column
        dataField="causa"
        caption="Causa"
        alignment="left"
      />
      <Column
        type="buttons"
        width={50}
        buttons={[
          {
            icon: 'arrowright',
            //stylingMode: 'text',
            hint: 'Select',
            onClick: e => onCaseSelect(e.row.data.name)  // Twój callback
          }
        ]}
      />
    </DataGrid>
  </div>
);


};

export default SearchAndCaseList;
