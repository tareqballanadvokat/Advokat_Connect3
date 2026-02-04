// src/taskpane/components/tabs/email/SearchCaseList.tsx
import React, { useState, useEffect } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { aktLookUpAsync, setSearchTerm, clearCases, clearPreviousSearchTerm } from '../../../../store/slices/aktenSlice';
import { AktLookUpResponse } from '../../interfaces/IAkten';
import notify from 'devextreme/ui/notify';

// Updated interface to match the new API model
interface SearchProps {
  onCaseSelect: (selectedCase: AktLookUpResponse) => void;
}

const SearchCaseList: React.FC<SearchProps> = ({ onCaseSelect }) => {
  const dispatch = useAppDispatch();
  const { cases, loading, error, searchTerm } = useAppSelector(state => state.akten);
  
  const [gridVisible, setGridVisible] = useState(false);

  // Handle Redux error states
  useEffect(() => {
    if (error) {
      notify(error, 'error', 5000);
    }
  }, [error]);

  // Update grid visibility when cases change
  useEffect(() => {
    setGridVisible(cases.length > 0);
  }, [cases]);

  // Clear previous search term on unmount to allow cache hits when returning
  useEffect(() => {
    return () => {
      dispatch(clearPreviousSearchTerm());
    };
  }, [dispatch]);

  const handleSearch = async () => {
    const filter = searchTerm.trim();
    
    if (!filter) {
      dispatch(clearCases());
      setGridVisible(false);
      return;
    }

    try {
      // Dispatch Redux action to search for cases
      // Using aktLookUpAsync - includes fake response for testing when WebRTC is not ready
      await dispatch(aktLookUpAsync(filter)).unwrap();
    } catch (error) {
      console.error('Search failed:', error);
      notify('Search cases failed', 'error', 5000);
    }
  };

  return (
    <div>
      <h3 style={{ width:'220px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        Search Cases
      </h3>

      {/* Search panel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextBox
          width={250}
          stylingMode="outlined"
          placeholder="Search by AktId (123) or Kürzel (ABC)..."
          value={searchTerm}
          onValueChanged={e => dispatch(setSearchTerm(e.value || ''))}
          onEnterKey={handleSearch}
          disabled={loading}
        />
        <Button 
          icon="search" 
          stylingMode="contained" 
          onClick={handleSearch}
          disabled={loading}
          text={loading ? "Searching..." : ""}
        />
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <span>Searching cases...</span>
        </div>
      )}

      {/* Results grid */}
      <DataGrid
        className="compact-grid"
        dataSource={cases}
        keyExpr="id"               
        showBorders={false}
        visible={gridVisible && !loading}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText="No cases found. Try a different search term."
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
              onClick: e => {
                const selectedCase = e.row.data as AktLookUpResponse;
                 onCaseSelect(selectedCase);
              }
            }
          ]}
        />
      </DataGrid>
    </div>
  );
};

export default SearchCaseList;
