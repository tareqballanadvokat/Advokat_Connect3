// src/taskpane/components/tabs/person/SearchPersonList.tsx
import React, { useState, useEffect } from 'react';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import type { RootState } from '../../../../store';
import { searchPersonsFakeAsync, clearPersons, setSearchTerm } from '../../../../store/slices/personSlice';
import { PersonLookUpResponse } from '../../interfaces/IPerson';
import notify from 'devextreme/ui/notify';

interface Props {
  onPersonSelect: (personId: number, personName: string) => void;
}

const SearchPersonList: React.FC<Props> = ({ onPersonSelect }) => {
  const dispatch = useAppDispatch();
  const personState = useAppSelector((state: RootState) => state.person);
  const { persons, loading, error, searchTerm, currentSearchTerm } = personState;
  
  const [searchValue, setSearchValue] = useState(searchTerm || '');
  const [gridVisible, setGridVisible] = useState(false);

  // Handle Redux error states
  useEffect(() => {
    if (error) {
      notify(error, 'error', 5000);
    }
  }, [error]);

  // Update grid visibility when persons change
  useEffect(() => {
    setGridVisible(persons.length > 0);
  }, [persons]);

  // Smart caching: Only search if we don't have cached data for the current search term
  useEffect(() => {
    if (searchValue.trim() && currentSearchTerm !== searchValue.trim()) {
      console.log(`🔍 Persons cache miss - loading persons for search term: "${searchValue.trim()}" (cached: "${currentSearchTerm}")`);
      handleSearch();
    } else if (searchValue.trim() && currentSearchTerm === searchValue.trim()) {
      console.log(`✅ Persons cache hit - using cached persons for search term: "${searchValue.trim()}"`);
    } else if (!searchValue.trim() && !currentSearchTerm) {
      // Load initial data with a default search only if no cache exists
      console.log(`🔍 Persons initial load - no cache exists`);
    }
  }, []); // Only run on mount

  const handleSearch = async () => {
    const query = searchValue.trim();
    
    if (!query) {
      dispatch(clearPersons());
      setGridVisible(false);
      return;
    }

    dispatch(setSearchTerm(query));
    
    try {
      await dispatch(searchPersonsFakeAsync({ 
        nKurzLike: query,
        name1Like: query,
        count: 20 
      })).unwrap();
      
      setGridVisible(true);
      
    } catch (error) {
      console.error('Search failed:', error);
      notify('Search failed', 'error', 5000);
    }
  };

  const handleAddToFavorites = (person: PersonLookUpResponse) => {
    onPersonSelect(person.personId, person.anzeigename);
  };


  return (
    <div>
       <h3 style={{ width:'220px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        Search Persons
      </h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextBox
          width={250}
          stylingMode="outlined"
          placeholder="Search..."
          value={searchValue}
          onValueChanged={e => setSearchValue(e.value)}
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

      {loading && (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <span>Searching persons...</span>
        </div>
      )}

      <DataGrid
        className="compact-grid"
        dataSource={persons}
        keyExpr="personId"
        showBorders={false}
        visible={gridVisible && !loading}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText="No persons found. Try a different search term."
      >
        <Paging defaultPageSize={5} />
        <Pager
          visible
          showPageSizeSelector={false}
          allowedPageSizes={[5]}
          showInfo
        />
        <Column
          dataField="personId"
          caption="Person ID"
          visible={false}
          alignment="left"
        />
        <Column
          dataField="nKurz"
          caption="ID"
          alignment="left"
          width={100}
        />
        <Column
          dataField="anzeigename"
          caption="Name"
          alignment="left"
        />
        <Column
          dataField="adressdaten.ort"
          caption="City"
          alignment="left"
          width={120}
        />
        <Column
          type="buttons"
          width={50}
          buttons={[
            {
              icon: 'add',
              hint: 'Add to favorites',
              onClick: (e) => handleAddToFavorites(e.row.data)
            }
          ]}
        />
      </DataGrid>
    </div>
  );
};

export default SearchPersonList;
