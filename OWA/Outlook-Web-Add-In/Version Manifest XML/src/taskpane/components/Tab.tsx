import React, { useState, Suspense, lazy } from 'react';
// import Tab1Content from './Tab1Content';
// import Tab2Content from './Tab2Content';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';

// lazy-import każdego komponentu
const Tab1Content = lazy(() => import('./tabs/case/Tab1Content'));
const Tab2Content = lazy(() => import('./tabs/email/Tab2Content'));
const Tab3Content = lazy(() => import('./tabs/person/Tab3Content'));
const Tab4Content = lazy(() => import('./tabs/email/Tab2Content'));

const DevTabs: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const renderContent = () => {
    switch (selectedIndex) {
      case 0: return <Tab1Content />;
      case 1: return <Tab2Content />;
      case 2: return <Tab3Content />;
      case 3: return <Tab4Content />;
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
