// src/taskpane/components/tabs/email/SearchCaseList.tsx
import React, { useState, useEffect } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import LoadIndicator from 'devextreme-react/load-indicator';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { selectIsReady } from '../../../../store/slices/connectionSlice';
import { aktLookUpAsync, setSearchTerm, clearCases, clearPreviousSearchTerm } from '../../../../store/slices/aktenSlice';
import { AktLookUpResponse } from '../../interfaces/IAkten';
import notify from 'devextreme/ui/notify';
import { getLogger } from '../../../../services/logger';

const logger = getLogger();

// Updated interface to match the new API model
interface SearchProps {
  onCaseSelect: (selectedCase: AktLookUpResponse) => void;
}

const SearchCaseList: React.FC<SearchProps> = ({ onCaseSelect }) => {
  const dispatch = useAppDispatch();
  const { cases, loading, error, searchTerm, selectedAkt, foldersLoading, emailDocumentsLoading } = useAppSelector(state => state.akten);
  const servicesLoading = useAppSelector(state => state.service.servicesLoading);
  const registeredEmailsLoading = useAppSelector(state => state.email.registeredEmailsLoading);
  const registeredServicesLoading = useAppSelector(state => state.service.registeredServicesLoading);
  const isReady = useAppSelector(selectIsReady);
  const anyAktLoading = foldersLoading || servicesLoading || registeredEmailsLoading || emailDocumentsLoading || registeredServicesLoading;

  // Handle Redux error states
  useEffect(() => {
    if (error) {
      notify(error, 'error', 5000);
    }
  }, [error]);

  // Clear previous search term on unmount to allow cache hits when returning
  useEffect(() => {
    return () => {
      dispatch(clearPreviousSearchTerm());
    };
  }, [dispatch]);

  const handleSearch = async () => {
    if(loading) return; // Prevent multiple simultaneous searches
    const filter = searchTerm.trim();
    
    if (!filter) {
      dispatch(clearCases());
      return;
    }

    try {
      // Dispatch Redux action to search for cases
      // Using aktLookUpAsync - includes fake response for testing when WebRTC is not ready
      await dispatch(aktLookUpAsync(filter)).unwrap();
    } catch (error) {
      logger.error('Search failed', 'SearchCaseList', error);
      if (isReady) {
        notify('Search cases failed', 'error', 5000);
      }
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
        visible={!loading}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText="No cases found."
        onRowPrepared={e => {
          if (e.rowType === 'data') {
            e.rowElement.style.height = '36px';
            if (e.data?.id === selectedAkt?.id) {
              e.rowElement.style.borderLeft = '3px solid #0078d4';
              e.rowElement.style.fontWeight = '600';
            } else {
              e.rowElement.style.borderLeft = '3px solid transparent';
            }
          }
        }}
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
          width={40}
          alignment="center"
          cellRender={(data: { data: AktLookUpResponse }) => {
            const isSelected = selectedAkt?.id === data.data.id;
            return (
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Button
                  icon="arrowright"
                  stylingMode="text"
                  hint={!anyAktLoading ? 'Select' : undefined}
                  onClick={() => !anyAktLoading && onCaseSelect(data.data)}
                  elementAttr={{ style: `color: #0078d4; visibility: ${anyAktLoading ? 'hidden' : 'visible'};` }}
                />
                {isSelected && anyAktLoading && (
                  <div style={{ position: 'absolute' }}>
                    <LoadIndicator width={20} height={20} />
                  </div>
                )}
              </div>
            );
          }}
        />
      </DataGrid>
    </div>
  );
};

export default SearchCaseList;
