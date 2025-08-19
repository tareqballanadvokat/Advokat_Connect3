import React, { useState, Suspense, lazy, useEffect, useRef } from 'react';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';
// import  { Person } from './tabs/person/PersonTabContent'; 
//  import {SipClient} from "./tabs/SipClient"; 
import { sipClientService } from '../services/sipClientService';
// lazy-import
const ServiceTab = lazy(() => import('./tabs/service/ServiceTabContent'));
const EmailTab  = lazy(() => import('./tabs/email/EmailTabContent'));
const PersonTab  = lazy(() => import('./tabs/person/PersonTabContent'));
const CaseTabContent = lazy(() => import('./tabs/case/CaseTabContent'));

const DevTabs: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const sipRef = useRef(null);
// useEffect(() => {
//     SipClient(); // uruchomienie kodu SIP
//   }, []);

  // Removed duplicate SIP initialization - now handled by singleton service
  // useEffect(() => {
  //   sipRef.current = initializeSipClient();
  // }, []);


  const handleDelete = (_id: string) => {
    // TODO: Implement delete functionality
  };

  const handleAdd = (_id: string) => {
    // TODO: Implement add functionality
  };

  const renderContent = () => {
    switch (selectedIndex) {
      case 0: return <EmailTab />;
      case 1: return <ServiceTab />;
      case 2: return <CaseTabContent />;
      case 3: return <PersonTab />;
      default: return null;
    }
  };

  return (
    <div  className="dx-compact"> 
      <Tabs
        width={280}
        selectedIndex={selectedIndex}
        onItemClick={e => setSelectedIndex(e.itemIndex)}
       
        showNavButtons={false}
      >
        <Item text="E-Mail" />
        <Item text="Service" />
        <Item text="Case"    />
        <Item text="Person" />
      </Tabs>

      {/* Suspense pokaże fallback tylko przy pierwszym ładowaniu chunka */}
      <div style={{ marginTop: 16 }}>
        <Suspense fallback={<div>Loading tab…</div>}>
          {renderContent()}
        </Suspense>
      </div>
    </div>
  );
};

export default DevTabs;
