import React, { useState, Suspense, lazy, useEffect, useRef } from 'react';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';
// lazy-import
const ServiceTab = lazy(() => import('./tabs/service/ServiceTabContent'));
const EmailTab  = lazy(() => import('./tabs/email/EmailTabContent'));
const PersonTab  = lazy(() => import('./tabs/person/PersonTabContent'));
const CaseTabContent = lazy(() => import('./tabs/case/CaseTabContent'));

const DevTabs: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);

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
