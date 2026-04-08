// src/taskpane/components/tabs/email/SearchCaseList.tsx
import React, { useState, useEffect } from 'react';
import './SearchCaseList.css';
import './shared.css';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import LoadIndicator from 'devextreme-react/load-indicator';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { selectIsReady } from '@slices/connectionSlice';
import { aktLookUpAsync, setSearchTerm, clearCases, clearPreviousSearchTerm } from '@slices/aktenSlice';
import { AktLookUpResponse } from '@interfaces/IAkten';
import notify from 'devextreme/ui/notify';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();

// Updated interface to match the new API model
interface SearchProps {
  onCaseSelect: (selectedCase: AktLookUpResponse) => void;
}

const SearchCaseList: React.FC<SearchProps> = ({ onCaseSelect }) => {
  const dispatch = useAppDispatch();
  const [hasSearched, setHasSearched] = useState(false);
  const { cases, loading, error, searchTerm, selectedAkt, foldersLoading, emailDocumentsLoading } = useAppSelector(state => state.akten);
  const servicesLoading = useAppSelector(state => state.service.servicesLoading);
  const registeredEmailsLoading = useAppSelector(state => state.email.registeredEmailsLoading);
  const registeredServicesLoading = useAppSelector(state => state.service.registeredServicesLoading);
  const isReady = useAppSelector(selectIsReady);
  const anyAktLoading = foldersLoading || servicesLoading || registeredEmailsLoading || emailDocumentsLoading || registeredServicesLoading;
  const { t: translate } = useTranslation(['email', 'common']);

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
    if (!isReady) {
      notify(translate('common:connectingWait'), 'warning', 3000);
      return;
    }
    const filter = searchTerm.trim();
    
    if (!filter) {
      notify(translate('common:enterSearchTerm'), 'warning', 3000);
      // dispatch(clearCases());
      return;
    }

    try {
      // Dispatch Redux action to search for cases
      // Using aktLookUpAsync - includes fake response for testing when WebRTC is not ready
      setHasSearched(true);
      await dispatch(aktLookUpAsync(filter)).unwrap();
    } catch (error) {
      logger.error('Search failed', 'SearchCaseList', error);
      if (isReady) {
        notify(translate('searchCasesFailed'), 'error', 5000);
      }
    }
  };

  return (
    <div>
      <h3 className="shared-search-case-title">
        {translate('searchCases')}
      </h3>

      {/* Search panel */}
      <div className="shared-search-case-panel">
        <TextBox
          width={250}
          stylingMode="outlined"
          placeholder={translate('searchCasePlaceholder')}
          value={searchTerm}
          onValueChanged={e => dispatch(setSearchTerm(e.value || ''))}
          onEnterKey={handleSearch}
          disabled={loading || !isReady}
        />
        <Button 
          icon="search" 
          stylingMode="contained" 
          onClick={handleSearch}
          disabled={loading || !isReady}
          text={loading ? translate('common:buttons.searching') : ""}
        />
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="shared-search-case-loading">
          <span>{translate('common:searchingCases')}</span>
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
        noDataText={loading ? translate('common:loading') : hasSearched ? translate('common:noResultsFound') : translate('searchCases')}
        selectedRowKeys={selectedAkt ? [selectedAkt.id] : []}
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
          caption={translate('common:columns.caseId')}
          visible={false} 
          alignment="left"
        />
        <Column
          dataField="aKurz"
          caption={translate('common:columns.kuerzel')}
          alignment="left"
        />
        <Column
          dataField="causa"
          caption={translate('common:columns.causa')}
          alignment="left"
        />
        <Column
          width={40}
          alignment="center"
          cellRender={(data: { data: AktLookUpResponse }) => {
            const isSelected = selectedAkt?.id === data.data.id;
            return (
              <div className="shared-search-case-select-btn-wrapper">
                <Button
                  icon="arrowright"
                  stylingMode="text"
                  hint={!anyAktLoading ? translate('common:select') : undefined}
                  onClick={() => !anyAktLoading && onCaseSelect(data.data)}
                  elementAttr={{ style: `color: #0078d4; visibility: ${anyAktLoading ? 'hidden' : 'visible'};` }}
                />
                {isSelected && anyAktLoading && (
                  <div className="shared-search-case-loading-indicator">
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
