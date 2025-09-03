// src/taskpane/components/tabs/case/SearchCaseList.tsx
import React, { useState, useEffect } from 'react';
import './SearchCaseList.css'; // Import our custom CSS
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { aktLookUpAsync, clearCases, setSearchTerm, addAktToFavoriteAsync, getFavoriteAktenAsync } from '../../../../store/slices/aktenSlice';
import notify from 'devextreme/ui/notify';

const SearchCaseList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { cases, favouriteAkten, loading, error, searchTerm, currentSearchTerm } = useAppSelector(state => state.akten);
  
  const [searchValue, setSearchValue] = useState(searchTerm || '');

  // Check if an Akt is already in favorites
  const isInFavorites = (aktId: number): boolean => {
    if (!favouriteAkten || !Array.isArray(favouriteAkten) || favouriteAkten.length === 0) {
      // When no favorites are loaded, show star button (allow adding to favorites)
      return false;
    }
    return favouriteAkten.some(fav => fav.Id === aktId);
  };

  // Handle adding Akt to favorites
  const handleAddToFavorites = async (aktId: number, aKurz: string) => {
    try {
      await dispatch(addAktToFavoriteAsync(aktId)).unwrap();
      notify(`Successfully added "${aKurz}" to favorites!`, 'success', 3000);
      
      // Reload the favorites list to include the newly added Akt
      dispatch(getFavoriteAktenAsync({ 
        NurFavoriten: true,
        Count: 50 
      }));
    } catch (error) {
      console.error('Failed to add to favorites:', error);
      notify(`Failed to add "${aKurz}" to favorites: ${error}`, 'error', 5000);
    }
  };

  const handleSearch = async () => {
    const query = searchValue.trim();
    
    if (!query) {
      dispatch(clearCases());
      return;
    }

    // Update search term in Redux
    dispatch(setSearchTerm(query));
    
    try {
      await dispatch(aktLookUpAsync(query)).unwrap();
    } catch (error) {
      console.error('Search failed:', error);
      notify('Search cases failed via WebRTC', 'error', 5000);
    }
  };

  useEffect(() => {
    // Load favorites if not already loaded (needed for button visibility)
    if (!favouriteAkten || favouriteAkten.length === 0) {
      console.log('🌟 Loading favorites for star button visibility');
      dispatch(getFavoriteAktenAsync({ 
        NurFavoriten: true,
        Count: 50 
      }));
    }
  }, [dispatch]); // Remove favouriteAkten from deps to avoid infinite loop

  useEffect(() => {
    // Smart caching: Only search if we don't have cached data for the current search term
    // This prevents unnecessary API calls when switching between tabs
    if (searchValue.trim() && currentSearchTerm !== searchValue.trim()) {
      console.log(`🔍 Cases cache miss - loading cases for search term: "${searchValue.trim()}" (cached: "${currentSearchTerm}")`);
      handleSearch();
    } else if (searchValue.trim() && currentSearchTerm === searchValue.trim()) {
      console.log(`✅ Cases cache hit - using cached cases for search term: "${searchValue.trim()}"`);
    } else if (!searchValue.trim() && !currentSearchTerm) {
      // Load initial data with a default search only if no cache exists
      console.log(`🔍 Cases initial load - no cache exists`);
      handleSearch();
    }
  }, []); // Only run on mount

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
          onEnterKey={handleSearch}
        />
        <Button 
          icon="search" 
          stylingMode="contained" 
          onClick={handleSearch}
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
      visible={cases.length > 0 || loading}
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
        width={80}
        buttons={[
          {
            icon: 'favorites',
            hint: 'Add to Favorites',
            cssClass: 'star-button-gold',
            visible: e => !isInFavorites(e.row.data.aktId),
            onClick: e => handleAddToFavorites(e.row.data.aktId, e.row.data.aKurz)
          },
          {
            icon: 'check',
            hint: 'Already in Favorites',
            visible: e => isInFavorites(e.row.data.aktId),
            disabled: true
          }
        ]}
      />
    </DataGrid>
  </div>
);

};

export default SearchCaseList;
