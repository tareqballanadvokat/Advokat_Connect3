// src/taskpane/components/tabs/case/SearchCaseList.tsx
import React, { useState, useEffect } from 'react';
import './SearchCaseList.css'; // Import our custom CSS
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { selectIsReady } from '../../../../store/slices/connectionSlice';
import { aktLookUpAsync, clearCases, setSearchTerm, addAktToFavoriteAsync, clearPreviousSearchTerm } from '../../../../store/slices/aktenSlice';
import notify from 'devextreme/ui/notify';
import { getFavoriteAktenAsync } from '../../../../store/slices/aktenSlice';
import { getLogger } from '../../../../services/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();
const SearchCaseList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t: translate } = useTranslation(['case', 'common']);
  const [hasSearched, setHasSearched] = useState(false);
  const { cases, favouriteAkten, loading, favoritesLoading, favoritesLoaded, addToFavoriteLoading, addingToFavoriteAktId, error, searchTerm } = useAppSelector(state => state.akten);
  const isReady = useAppSelector(selectIsReady);

  // Cleanup: Reset searchCounter when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearPreviousSearchTerm());
    };
  }, [dispatch]);

  // Check if an Akt is already in favorites
  const isInFavorites = (aktId: number): boolean => {
    // If favorites haven't been loaded or are still loading, we don't know the status yet
    if (!favoritesLoaded || favoritesLoading) {
      return false; // Will be handled by showing disabled state
    }
    
    // If favorites are loaded, check if this Akt is in the list
    return favouriteAkten.some(fav => fav.id === aktId);
  };

  // Check if case is being added to favorites
  const isAddingToFavorites = (aktId: number): boolean => {
    return addToFavoriteLoading && addingToFavoriteAktId === aktId;
  };

  // Check if star button should be disabled (when favorites are loading or not loaded yet)
  const isStarButtonDisabled = (aktId: number): boolean => {
    return !favoritesLoaded || favoritesLoading || isAddingToFavorites(aktId);
  };

  // Handle adding Akt to favorites
  const handleAddToFavorites = async (aktId: number, aKurz: string) => {
    // Prevent duplicate requests
    if (addToFavoriteLoading && addingToFavoriteAktId === aktId) {
      return;
    }

    try {
      await dispatch(addAktToFavoriteAsync(aktId)).unwrap();
      await dispatch(getFavoriteAktenAsync({ 
              NurFavoriten: true,
              Count: 50
            })).unwrap();
      notify(translate('addedToFavorites', { aKurz }), 'success', 3000);
    } catch (error) {
      logger.error('Failed to add to favorites:', 'SearchCaseList', error);
      notify(translate('failedToAddToFavorites', { aKurz }), 'error', 5000);
    }
  };

  const handleSearch = async () => {
    // Prevent multiple concurrent searches
    if (loading) {
      return;
    }
    if (!isReady) {
      notify(translate('common:connectingWait'), 'warning', 3000);
      return;
    }

    const query = searchTerm.trim();
    
    if (!query) {
      notify(translate('common:enterSearchTerm'), 'warning', 3000);
      // dispatch(clearCases());
      return;
    }

    try {
      setHasSearched(true);
      await dispatch(aktLookUpAsync(query)).unwrap();
    } catch (error) {
      logger.error('Search failed:', 'SearchCaseList', error);
      if (isReady) {
        notify(translate('searchCasesFailed'), 'error', 5000);
      }
    }
  };

  return (
    <div>
        <h3 style={{ width:'220px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {translate('searchCasesHeading')}
        </h3>

      {/* Search panel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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

      {/* Error message */}
      {error && (
        <div style={{ color: 'red', marginBottom: 16, padding: 8, backgroundColor: '#fee' }}>
          {translate('common:errorPrefix')}: {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          {translate('common:searchingViaWebRTC')}
        </div>
      )}

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
      noDataText={loading ? translate('common:loading') : hasSearched ? translate('common:noResultsFound') : translate('searchAkten')}
    >
      <Paging defaultPageSize={5} />
      <Pager
        visible
        showPageSizeSelector={false}
        allowedPageSizes={[5]}
        showInfo
      />
      
      <Column
        dataField="id"
        caption={translate('columns.aktId')}
        visible={false}
        alignment="left"
      />
      <Column
        type="buttons"
        width={80}
        buttons={[
          {
            icon: 'favorites',
            hint: favoritesLoading ? translate('loadingFavorites') : translate('addToFavorites'),
            cssClass: 'star-button-gold',
            visible: e => !isInFavorites(e.row.data.id) && !isAddingToFavorites(e.row.data.id),
            disabled: e => isStarButtonDisabled(e.row.data.id),
            onClick: e => !isStarButtonDisabled(e.row.data.id) && handleAddToFavorites(e.row.data.id, e.row.data.aKurz)
          },
          {
            icon: 'refresh',
            hint: translate('addingToFavorites'),
            cssClass: 'loading-button',
            visible: e => isAddingToFavorites(e.row.data.id),
            disabled: true
          },
          {
            icon: 'check',
            hint: translate('alreadyInFavorites'),
            visible: e => isInFavorites(e.row.data.id),
            disabled: true
          }
        ]}
      />
      <Column
        dataField="aKurz"
        caption={translate('columns.kuerzel')}
        alignment="left"
      />
      <Column
        dataField="causa"
        caption={translate('columns.causa')}
        alignment="left"
      />
    </DataGrid>
  </div>
);

};

export default SearchCaseList;
