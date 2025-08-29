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
    if (person.Titel) parts.push(person.Titel);
    if (person.Vorname) parts.push(person.Vorname);
    if (person.Name1) parts.push(person.Name1);
    if (person.Name2) parts.push(person.Name2);
    if (person.Name3) parts.push(person.Name3);
    return parts.join(' ') || person.NKurz || 'Unknown Person';
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

  // callback for opening/closing Accordion
  const handleSelectionChanged = useCallback((e: AccordionTypes.SelectionChangedEvent) => {
    setExpandedItems(e.addedItems as PersonResponse[]);
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
            onDelete={() => handleDelete(data.Id, getDisplayName(data))} // Use Id instead of PersonId
          />
        )}
        itemRender={CustomItem}
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
