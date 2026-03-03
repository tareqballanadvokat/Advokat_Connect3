// src/taskpane/components/tabs/person/SearchPersonList.tsx
import React, { useState, useEffect } from 'react';
import './person.css'; // Import our custom CSS for star button styling
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import type { RootState } from '../../../../store';
import { selectIsReady } from '../../../../store/slices/connectionSlice';
import { personLookUpAsync, clearPersons, setSearchTerm, clearPreviousSearchTerm } from '../../../../store/slices/personSlice';
import { PersonLookUpResponse } from '../../interfaces/IPerson';
import notify from 'devextreme/ui/notify';
import { getLogger } from '../../../../services/logger';

const logger = getLogger();

interface Props {
  onPersonSelect: (personId: number, personName: string) => void;
}

const SearchPersonList: React.FC<Props> = ({ onPersonSelect }) => {
  const dispatch = useAppDispatch();
  const personState = useAppSelector((state: RootState) => state.person);
  const isReady = useAppSelector(selectIsReady);
  const { persons, loading, addToFavoriteLoading, addingToFavoritePersonId, error, searchTerm, favorites } = personState;

  // Helper function to create display name from person data
  const getDisplayName = (person: PersonLookUpResponse) => {
    const parts = [];
    if (person.titel) parts.push(person.titel);
    if (person.vorname) parts.push(person.vorname);
    if (person.name1) parts.push(person.name1);
    if (person.name2) parts.push(person.name2);
    if (person.name3) parts.push(person.name3);
    return parts.join(' ') || person.nKurz || 'Unknown Person';
  };

  // Check if person is in favorites
  const isInFavorites = (personId: number): boolean => {
    return favorites.some(fav => fav.id === personId);
  };

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
    const query = searchTerm.trim();
    
    if (!query) {
      dispatch(clearPersons());
      return;
    }
    
    try {
      await dispatch(personLookUpAsync(query)).unwrap();
    } catch (error) {
      logger.error('Search failed:', 'SearchPersonList', error);
      if (isReady) {
        notify('Search failed', 'error', 5000);
      }
    }
  };

  // Check if person is being added to favorites
  const isAddingToFavorites = (personId: number): boolean => {
    return addToFavoriteLoading && addingToFavoritePersonId === personId;
  };

  const handleAddToFavorites = async (person: PersonLookUpResponse) => {
    // Prevent duplicate requests
    if (addToFavoriteLoading && addingToFavoritePersonId === person.id) {
      return;
    }

    try {
      await onPersonSelect(person.id, getDisplayName(person));
    } catch (error) {
      logger.error('Failed to add person to favorites:', 'SearchPersonList', error);
      notify('Failed to add person to favorites', 'error', 3000);
    }
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

      {loading && (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <span>Searching persons...</span>
        </div>
      )}

      <DataGrid
        className="compact-grid"
        dataSource={persons}
        keyExpr="id"
        showBorders={false}
        visible={!loading}
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
          dataField="id"
          caption="Person ID"
          visible={false}
          alignment="left"
        />
        <Column
          type="buttons"
          width={80}
          buttons={[
            {
              icon: 'favorites',
              hint: 'Add to favorites',
              cssClass: 'star-button-gold',
              visible: e => !isInFavorites(e.row.data.id) && !isAddingToFavorites(e.row.data.id),
              onClick: (e) => handleAddToFavorites(e.row.data)
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
              hint: 'Already in favorites',
              visible: e => isInFavorites(e.row.data.id),
              disabled: true
            }
          ]}
        />
        <Column
          dataField="nKurz"
          caption="Kürzl"
          alignment="left"
          width={100}
        />
        <Column
          caption="Name"
          alignment="left"
          cellRender={(data) => <span>{getDisplayName(data.data)}</span>}
        />
        <Column
          dataField="adresse.ort"
          caption="City"
          alignment="left"
          width={120}
        />
      </DataGrid>
    </div>
  );
};

export default SearchPersonList;
