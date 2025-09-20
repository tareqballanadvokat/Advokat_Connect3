// src/taskpane/components/tabs/person/PersonTabContent.tsx
import 'devextreme/dist/css/dx.light.css';
import React, { useState, useEffect, useCallback } from 'react';
import Accordion, { type AccordionTypes } from 'devextreme-react/accordion';
import SearchPersonList from './SearchPersonList';
import CustomTitle from './CustomTitle';
import CustomItem from './CustomItem';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { PersonLookUpResponse, PersonResponse } from '../../interfaces/IPerson';
import { 
  personLookUpAsync, 
  addPersonToFavoritesAsync, 
  removePersonFromFavoritesAsync,
  getFavoritePersonsAsync
} from '../../../../store/slices/personSlice';
import notify from 'devextreme/ui/notify';
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus'; 

interface Props {
  loading?: boolean;
}

const PersonTabContent: React.FC<Props> = ({ loading = false }) => {
  const dispatch = useAppDispatch();
  const { favorites, favoritesLoading } = useAppSelector(state => state.person);
  
  const [expandedItems, setExpandedItems] = useState<PersonResponse[]>([]);

  // Helper function to create display name from person data (works for both PersonLookUpResponse and PersonResponse)
  const getDisplayName = (person: PersonLookUpResponse | PersonResponse) => {
    const parts = [];
    if (person.titel) parts.push(person.titel);
    if (person.vorname) parts.push(person.vorname);
    if (person.name1) parts.push(person.name1);
    if (person.name2) parts.push(person.name2);
    if (person.name3) parts.push(person.name3);
    return parts.join(' ') || person.nKurz || 'Unknown Person';
  };

  // Load favorites on startup
  useEffect(() => {
    dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));
  }, [dispatch]);

  // callback when someone in SearchPersonList adds a new person
  const handlePersonAdd = useCallback(async (personId: number, personName: string) => {
    try {
      await dispatch(addPersonToFavoritesAsync(personId)).unwrap();
      notify(`Added "${personName}" to favorites`, 'success', 3000);
    } catch (error) {
      console.error("Error adding person:", error);
      notify('Failed to add person to favorites', 'error', 5000);
    }
  }, [dispatch]);

  // callback for opening/closing Accordion (based on DevExtreme sample)
  const handleSelectionChanged = useCallback((e: AccordionTypes.SelectionChangedEvent) => {
    setExpandedItems(prevItems => {
      let newItems = [...prevItems];
      
      // Remove collapsed items
      e.removedItems.forEach((item) => {
        const index = newItems.findIndex(selectedItem => selectedItem.id === (item as PersonResponse).id);
        if (index >= 0) {
          newItems.splice(index, 1);
        }
      });
      
      // Add expanded items
      if (e.addedItems.length) {
        newItems = [...newItems, ...(e.addedItems as PersonResponse[])];
      }
      
      return newItems;
    });
  }, []);

  // removing person
  const handleDelete = useCallback(async (personId: number, personName: string) => {
    try {
      await dispatch(removePersonFromFavoritesAsync(personId)).unwrap();
      notify(`Removed "${personName}" from favorites`, 'success', 3000);
    } catch (error) {
      console.error("Error removing person:", error);
      notify('Failed to remove person from favorites', 'error', 5000);
    }
  }, [dispatch]);



  return (
    <div id="accordion" style={{
      margin: '0 auto',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      
      {/* WebRTC Connection Status */}
      <WebRTCConnectionStatus />

      {/* Person Search */}
      <SearchPersonList onPersonSelect={handlePersonAdd} />

      {/* Favorites Accordion */}
      <Accordion
        dataSource={favorites}
        collapsible={true}
        multiple={true}
        animationDuration={500}
        keyExpr="Id" // Use Id instead of PersonId for PersonResponse

        // controlled expansion state
        selectedItems={expandedItems}
        onSelectionChanged={handleSelectionChanged}

        // templates
        itemTitleRender={(data: PersonResponse) => (
          <CustomTitle
            anzeigename={getDisplayName(data)}
            onDelete={() => handleDelete(data.id, getDisplayName(data))}
          />
        )}
        itemRender={(data: PersonResponse) => <CustomItem {...data} />}
      />

      {(loading || favoritesLoading) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          fontSize: 18,
          fontWeight: 600,
          color: '#4a5568',
          backgroundColor: '#be5911ff'
        }}>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#fff' }}>
            Loading…
          </span>
        </div>
      )}
    </div>
  );
};

export default PersonTabContent;
