// src/taskpane/components/tabs/email/SearchAndCaseList.tsx
import React, { useState, useEffect } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { CaseItem } from '../../interfaces/ISearchCase'
import { getCases  } from '../../../utils/api';
//import 'devextreme/dist/css/dx.material.blue.light.compact.css';

// import 'devextreme/scss/widgets/material/sizes';
// import 'devextreme/scss/widgets/material/colors';
// import 'devextreme/scss/widgets/material/icons';
// import 'devextreme/scss/widgets/base/draggable';
// import 'devextreme/scss/widgets/base/resizable';
// import 'devextreme/scss/widgets/base/ui';
// import 'devextreme/scss/widgets/material/widget';
// import 'devextreme/scss/widgets/material/card';
// import 'devextreme/scss/widgets/material/fieldset';
// import 'devextreme/scss/widgets/material/common';
// import 'devextreme/scss/widgets/material';

// import 'devextreme/scss/widgets/material/colors'// with ($color: 'blue', $mode: 'light');
// import 'devextreme/scss/widgets/material/sizes' //with ($size: 'compact');
// import 'devextreme/scss/widgets/material/icons';
// import 'devextreme/scss/widgets/material/widget';
// import 'devextreme/scss/widgets/material/card';
// import 'devextreme/scss/widgets/material/fieldset';
// import 'devextreme/scss/widgets/material/common';
// import 'devextreme/scss/widgets/base/resizable';
// import 'devextreme/scss/widgets/base/draggable';
// import 'devextreme/scss/widgets/base/ui';
// import 'devextreme/scss/widgets/material';



interface Props {
  onCaseSelect: (caseId: string) => void;
}

const SearchCaseList: React.FC<Props> = ({ onCaseSelect }) => {
  const [searchValue, setSearchValue] = useState('');
  const [rows, setRows] = useState<CaseItem[]>([]);
  const [fullData, setFullData] = useState<CaseItem[]>([]);


  const handleSearch = async () => {
    const filter = searchValue.trim().toLowerCase();
    const data = await getCases(filter);
         setFullData(data);
         setRows(data);
    if (!filter) {
      setRows(fullData);
    } else {
      // setRows(
      //   fullData.filter(
      //     item =>
      //       item.name.toLowerCase().includes(filter) 
      //     //||  item.causa.toLowerCase().includes(filter),
      //   ),
      // );
      setRows(data);
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
   visible={rows.length>0}
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
            onClick: e => onCaseSelect(e.row.data.id)  // Twój callback
          }
        ]}
      />
    </DataGrid>
  </div>
);


};

export default SearchCaseList;
