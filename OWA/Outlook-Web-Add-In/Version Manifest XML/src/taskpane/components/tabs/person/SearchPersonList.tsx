// src/taskpane/components/tabs/email/SearchAndCaseList.tsx
import React, { useState, useEffect } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { API_BASE } from '../../../../config';
import { addPerson, Person   } from '../../../utils/api';
 
 

interface Props {
  onCaseSelect: (caseId: string) => void;
}

const SearchPersonList: React.FC<Props> = ({ onCaseSelect }) => {
  const [searchValue, setSearchValue] = useState('');
  const [gridVisible, setGridVisible] = useState(false);
  const [rows, setRows] = useState<Person[]>([]);
  const [fullData, setFullData] = useState<Person[]>([]);

  useEffect(() => {
    // fetch initial data
    (async () => {
      try {
        const resp = await fetch(API_BASE+'api/person/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '' })   // lub inny payload
        });
        const data: Person[] = await resp.json();
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
            item.fullName.toLowerCase().includes(filter) 
          //||  item.causa.toLowerCase().includes(filter),
        ),
      );
       setGridVisible(true);
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
   visible={gridVisible}
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
        dataField="fullName"
        caption="Name"
        alignment="left"
      />
      <Column
        dataField="address"
        caption="Causa"
        alignment="left"
      />
      <Column
        type="buttons"
        width={50}
        buttons={[
          {
            icon: 'add',
            //stylingMode: 'text',
            hint: 'Select',
            onClick: e => onCaseSelect(e.row.data.id)  // Twój callback
          }
        ]}
      />
    </DataGrid>
  </div>
);


};

export default SearchPersonList;
