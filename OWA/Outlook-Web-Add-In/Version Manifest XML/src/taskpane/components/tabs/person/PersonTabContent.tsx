// src/taskpane/components/tabs/person/PersonTabContent.tsx
import 'devextreme/dist/css/dx.light.css';
import './person.css'; // Import our custom CSS for animations
import React, { useState, useEffect, useCallback } from 'react';
import Accordion, { type AccordionTypes } from 'devextreme-react/accordion';
import SearchPersonList from './SearchPersonList';
import CustomTitle from './CustomTitle';
import CustomItem from './CustomItem';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { selectIsReady } from '@slices/connectionSlice';
import { PersonLookUpResponse, PersonResponse } from '@interfaces/IPerson';
import { 
  addPersonToFavoritesAsync, 
  removePersonFromFavoritesAsync,
  getFavoritePersonsAsync
} from '@slices/personSlice';
import notify from 'devextreme/ui/notify';
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus';
import { getLogger } from '@services/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger(); 

interface Props {
  loading?: boolean;
}

const PersonTabContent: React.FC<Props> = () => {
  const dispatch = useAppDispatch();
  const { favorites, favoritesLoading, removeFromFavoriteLoading, removingFromFavoritePersonId } = useAppSelector(state => state.person);
  const isReady = useAppSelector(selectIsReady);
  const { t: translate } = useTranslation('person');
  
  const [expandedItems, setExpandedItems] = useState<PersonResponse[]>([]);

  // Helper function to create display name from person data (works for both PersonLookUpResponse and PersonResponse)
  const getDisplayName = (person: PersonLookUpResponse | PersonResponse) => {
    const parts = [];
    if (person.titel) parts.push(person.titel);
    if (person.vorname) parts.push(person.vorname);
    if (person.name1) parts.push(person.name1);
    if (person.name2) parts.push(person.name2);
    if (person.name3) parts.push(person.name3);
    return parts.join(' ') || person.nKurz || translate('unknownPerson');
  };

  // Load favorites on startup
  useEffect(() => {
    if (!isReady) return;
    dispatch(getFavoritePersonsAsync({ Count: 100, NurFavoriten: true }));
  }, [isReady, dispatch]);

  // callback when someone in SearchPersonList adds a new person
  const handlePersonAdd = useCallback(async (personId: number, personName: string) => {
    try {
      await dispatch(addPersonToFavoritesAsync(personId)).unwrap();
      notify(translate('addedToFavorites', { name: personName }), 'success', 3000);
    } catch (error) {
      logger.error('Error adding person:', 'PersonTabContent', error);
      notify(translate('failedToAddToFavorites'), 'error', 5000);
    }
  }, [dispatch]);

  // callback for opening/closing Accordion (based on DevExtreme sample)
  const handleSelectionChanged = useCallback((e: AccordionTypes.SelectionChangedEvent) => {
    let newItems = [...expandedItems];
    
    // Remove collapsed items
    e.removedItems.forEach((item) => {
      const index = newItems.indexOf(item as PersonResponse);
      if (index >= 0) {
        newItems.splice(index, 1);
      }
    });
    
    // Add expanded items
    if (e.addedItems.length) {
      newItems = [...newItems, ...(e.addedItems as PersonResponse[])];
    }
    
    setExpandedItems(newItems);
  }, [expandedItems]);

  // removing person
  const handleDelete = useCallback(async (personId: number, personName: string) => {
    // Prevent duplicate requests
    if (removeFromFavoriteLoading && removingFromFavoritePersonId === personId) {
      return;
    }

    try {
      await dispatch(removePersonFromFavoritesAsync(personId)).unwrap();
      notify(translate('removedFromFavorites', { name: personName }), 'success', 3000);
    } catch (error) {
      logger.error('Error removing person:', 'PersonTabContent', error);
      notify(translate('failedToRemoveFromFavorites'), 'error', 5000);
    }
  }, [dispatch, removeFromFavoriteLoading, removingFromFavoritePersonId]);



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
      {isReady && !favoritesLoading && favorites.length === 0 && (
        <div style={{ padding: '12px 16px', color: '#6b7280', fontSize: 14 }}>
          {translate('noFavoritePersons')}
        </div>
      )}
      {favoritesLoading && (
        <div style={{ padding: '12px 16px', color: '#6b7280', fontSize: 14 }}>
          {translate('loading', { ns: 'common' })}
        </div>
      )}
      {isReady && !favoritesLoading && favorites.length > 0 && (
      <Accordion
        dataSource={favorites}
        collapsible={true}
        multiple={true}
        animationDuration={500}
        keyExpr="id" // Use lowercase 'id' to match PersonResponse interface

        // controlled expansion state
        selectedItems={expandedItems}
        onSelectionChanged={handleSelectionChanged}

        // templates
        itemTitleRender={(data: PersonResponse) => (
          <CustomTitle
            anzeigename={getDisplayName(data)}
            isDeleting={removeFromFavoriteLoading && removingFromFavoritePersonId === data.id}
            onDelete={() => handleDelete(data.id, getDisplayName(data))}
          />
        )}
        itemRender={(data: PersonResponse) => <CustomItem {...data} />}
      />
      )}
    </div>
  );
};

export default PersonTabContent;
