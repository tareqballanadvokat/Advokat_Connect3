// src/taskpane/components/tabs/email/SearchAndCaseList.tsx
import React, { useState, useEffect } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { aktLookUpAsync, clearCases, setSearchTerm } from '../../../../store/slices/aktenSlice';
import { AktLookUpResponse } from '../../interfaces/IAkten';

 

interface CaseItem {
  aktId: number;
  aKurz: string;
  causa?: string;
}

interface Props {
  onCaseSelect: (caseId: string) => void;
}

const SearchAndCaseList: React.FC<Props> = ({ onCaseSelect }) => {
  const dispatch = useAppDispatch();
  const { cases, loading, error, searchTerm } = useAppSelector(state => state.akten);
  
  const [searchValue, setSearchValue] = useState(searchTerm || '');

  useEffect(() => {
    // Load initial data with a default search
    handleSearch('demo'); // Load some demo cases initially
  }, []);

  const handleSearch = async (searchQuery?: string) => {
    const query = searchQuery || searchValue.trim();
    
    if (!query) {
      dispatch(clearCases());
      return;
    }

    // Update search term in Redux
    dispatch(setSearchTerm(query));
    
    // Perform WebRTC-based search
    try {
      await dispatch(aktLookUpAsync(query)).unwrap();
    } catch (error) {
      console.error('Search failed:', error);
    }
  };



return (
  <div>
      <h3 style={{ width:'220px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        Search Cases via WebRTC
      </h3>

      {/* Search panel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextBox
          width={250}
          stylingMode="outlined"
          placeholder="Search by Kürzel..."
          value={searchValue}
          onValueChanged={e => setSearchValue(e.value)}
          onEnterKey={() => handleSearch()}
        />
        <Button 
          icon="search" 
          stylingMode="contained" 
          onClick={() => handleSearch()}
          disabled={loading}
        />
      </div>

      {/* Error message */}
      {error && (
        <div style={{ color: 'red', marginBottom: 16, padding: 8, backgroundColor: '#fee' }}>
          Error: {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          Searching via WebRTC...
        </div>
      )}

    <DataGrid
      className="compact-grid"
      dataSource={cases}
      keyExpr="aktId"
      showBorders={false}
      showColumnLines={false}
      showRowLines={true}
      columnAutoWidth={true}
      rowAlternationEnabled={false}
      noDataText={loading ? "Loading..." : "No cases found. Try searching for 'demo' or enter a Kürzel."}
    >
      <Paging defaultPageSize={5} />
      <Pager
        visible
        showPageSizeSelector={false}
        allowedPageSizes={[5]}
        showInfo
      />
      
      <Column
        dataField="aktId"
        caption="Akt ID"
        visible={false}
        alignment="left"
      />
      <Column
        dataField="aKurz"
        caption="Kürzel"
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
            hint: 'Select',
            onClick: e => onCaseSelect(e.row.data.aKurz)
          }
        ]}
      />
    </DataGrid>
  </div>
);


};

export default SearchAndCaseList;
