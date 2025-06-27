// src/taskpane/components/tabs/persons/PersonsTabContent.tsx
import 'devextreme/dist/css/dx.light.css';
import React, { useState, useEffect, useCallback } from 'react';
import Accordion, { type AccordionTypes } from 'devextreme-react/accordion';
import SearchPersonList from './SearchPersonList';
import CustomTitle from './CustomTitle';
import CustomItem  from './CustomItem';
import { getPersonApi, addPerson,removePerson } from '../../../utils/api';
import { Person } from '../../interfaces/IPerson';
// import SipRegister from '../SipClient';
// import JsSIP from 'jssip'; 

interface Props {
  loading?: boolean;
  sip? : any;
}

const PersonsTabContent: React.FC<Props> = ({ sip,  loading = false }) => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [expandedItems, setExpandedItems] = useState<Person[]>([]);


useEffect(() => {
    if (sip?.registration?.IsRegistrationProcessFinished) 
    {
      console.log("SIP registered");
    }

    if (sip?.peer2peer?.dataChannelPeer!=undefined) {
      console.log("P2P dataChannel opened");
    } 
}, []);

 
 //On startup loads saved data by user
  useEffect(() => {
    (async () => 
      {
        const list = await getPersonApi();
        setPersons(list);
      })();
  }, []);

  // callback kiedy ktoś w SearchPersonList doda nową osobę
const handlePersonAdd = useCallback(async (id: string) => {
  try {
    await addPerson(id);
    if (sip?.peer2peer?.dataChannelPeer!=undefined) 
    {
       sip?.peer2peer?.dataChannelPeer.send(id);
    } 

    const updatedList = await getPersonApi();
    setPersons(updatedList);

    const added = updatedList.find(p => p.id === id);
    if (added) {
      // Rozwiń ją automatycznie
      setExpandedItems(prev => [...prev, added]);
    }
  } catch (error) {
    console.error("Błąd przy dodawaniu osoby:", error);
  }
}, []);


  // callback przy otwieraniu/zamykania Accordion
  const handleSelectionChanged = useCallback((e: AccordionTypes.SelectionChangedEvent) => {
    setExpandedItems(e.addedItems as Person[]);
    console.log(e);
  }, []);

  // usuwanie osoby
  const handleDelete = useCallback((id: string) => {
    removePerson(id);
    setPersons(prev => prev.filter(p => p.id !== id));
    // też usuń z expandedItems, jeśli była rozwinięta
    setExpandedItems(prev => prev.filter(p => p.id !== id));
  }, []);



  return (
    <div id="accordion" style={{
      maxWidth: 400,
      margin: '0 auto',
      background: '#fff',
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>

    <div>
      {/* <WebRTCDataChannel isOfferer={false} sendSignal={sendSignal} incomingSignal={false} />  */}
      {/* <SipRegister
        uri="sip:1001@192.168.0.107:8081"
        wsServer="ws://192.168.0.107:8081"
        authorizationUsername="1001"
        authorizationPassword="TwojeHaslo"
      /> */}

            {/* <SipRegister
        uri="sip:1001@127.0.0.1:8081"
        wsServer="ws://127.0.0.1:8081"
        authorizationUsername="1001"
        authorizationPassword="TwojeHaslo"
      /> */}
    </div>

      <SearchPersonList 
      onCaseSelect={handlePersonAdd} />

      <Accordion
        dataSource={persons}
        collapsible={true}
        multiple={true}
        animationDuration={500}

        // 3) kontrolowany stan rozwinięcia
        selectedItems={expandedItems}
        onSelectionChanged={handleSelectionChanged}

        // templaty
        itemTitleRender={(data: Person) => (
          <CustomTitle
            id={data.id}
            fullName={data.fullName}
            onDelete={() => handleDelete(data.id)}
          />
        )}
        itemRender={CustomItem}
      />

      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          fontSize: 18,
          fontWeight: 600,
          color: '#4a5568'
        }}>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#a0aec0' }}>
            Loading…
          </span>
        </div>
      )}
    </div>
  );
};

export default PersonsTabContent;
