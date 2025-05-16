import React, { useState, Suspense, lazy } from 'react';
// import Tab1Content from './Tab1Content';
// import Tab2Content from './Tab2Content';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';

// lazy-import każdego komponentu
const CaseTab = lazy(() => import('./tabs/case/CaseTabContent'));
const EmailTab  = lazy(() => import('./tabs/email/EmailTabContent'));
const PersonTab = lazy(() => import('./tabs/person/PersonTabContent'));
const Tab4Content = lazy(() => import('./tabs/email/EmailTabContent'));

const DevTabs: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const renderContent = () => {
    switch (selectedIndex) {
      case 0: return <EmailTab />;
      case 1: return <CaseTab />;
      case 2: return <Tab4Content />;
      case 3: return <PersonTab />;
      default: return null;
    }
  };

  return (
    <div>
      <Tabs
        width={300}
        selectedIndex={selectedIndex}
        onItemClick={e => setSelectedIndex(e.itemIndex)}
       
        showNavButtons={false}
      >
        <Item text="E-Mail" />
        <Item text="Service" />
        <Item text="Case" icon="favorites" />
        <Item text="Person" icon="favorites" />
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
