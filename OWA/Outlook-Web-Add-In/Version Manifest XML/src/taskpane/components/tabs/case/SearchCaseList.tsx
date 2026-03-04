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

const logger = getLogger();
const SearchCaseList: React.FC = () => {
  const dispatch = useAppDispatch();
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
      notify(`Successfully added "${aKurz}" to favorites!`, 'success', 3000);
    } catch (error) {
      logger.error('Failed to add to favorites:', 'SearchCaseList', error);
      notify(`Failed to add "${aKurz}" to favorites: ${error}`, 'error', 5000);
    }
  };

  const handleSearch = async () => {
    // Prevent multiple concurrent searches
    if (loading) {
      return;
    }

    const query = searchTerm.trim();
    
    if (!query) {
      notify('Please enter a search term', 'warning', 3000);
      // dispatch(clearCases());
      return;
    }

    try {
      setHasSearched(true);
      await dispatch(aktLookUpAsync(query)).unwrap();
    } catch (error) {
      logger.error('Search failed:', 'SearchCaseList', error);
      if (isReady) {
        notify('Search cases failed via WebRTC', 'error', 5000);
      }
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
      keyExpr="id"
      showBorders={false}
      visible={!loading}
      showColumnLines={false}
      showRowLines={true}
      columnAutoWidth={true}
      rowAlternationEnabled={false}
      noDataText={loading ? 'Loading...' : hasSearched ? 'No results found, try a different search term' : 'Search Akten'}
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
        caption="Akt ID"
        visible={false}
        alignment="left"
      />
      <Column
        type="buttons"
        width={80}
        buttons={[
          {
            icon: 'favorites',
            hint: favoritesLoading ? 'Loading favorites...' : 'Add to Favorites',
            cssClass: 'star-button-gold',
            visible: e => !isInFavorites(e.row.data.id) && !isAddingToFavorites(e.row.data.id),
            disabled: e => isStarButtonDisabled(e.row.data.id),
            onClick: e => !isStarButtonDisabled(e.row.data.id) && handleAddToFavorites(e.row.data.id, e.row.data.aKurz)
          },
          {
            icon: 'refresh',
            hint: 'Adding to favorites...',
            cssClass: 'loading-button',
            visible: e => isAddingToFavorites(e.row.data.id),
            disabled: true
          },
          {
            icon: 'check',
            hint: 'Already in Favorites',
            visible: e => isInFavorites(e.row.data.id),
            disabled: true
          }
        ]}
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
    </DataGrid>
  </div>
);

};

export default SearchCaseList;
