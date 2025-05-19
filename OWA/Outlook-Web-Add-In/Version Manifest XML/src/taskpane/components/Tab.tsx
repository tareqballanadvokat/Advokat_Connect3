import React, { useState, Suspense, lazy, useEffect } from 'react';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';
import  { Person } from './tabs/person/PersonTabContent';
 
// lazy-import
const ServiceTab = lazy(() => import('./tabs/service/ServiceTabContent'));
const EmailTab  = lazy(() => import('./tabs/email/EmailTabContent'));
const PersonTab  = lazy(() => import('./tabs/person/PersonTabContent'));
const Tab4Content = lazy(() => import('./tabs/email/EmailTabContent'));

const DevTabs: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
 const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://localhost:7231/api/person/get')       // your WebAPI
      .then(r => r.json())
      .then((data: Person[]) => setPersons(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id: string) => {
    // call your delete-favorite endpoint…
    console.log(id);
  };

  const handleAdd = (id: string) => {
    // call your add-favorite endpoint…
    console.log(id);
  };

  const renderContent = () => {
    switch (selectedIndex) {
      case 0: return <EmailTab />;
      case 1: return <ServiceTab />;
      case 2: return <Tab4Content />;
      case 3: return <PersonTab   persons={persons}
      loading={loading}
      onDeleteFavorite={handleDelete}
      onAddFavorite={handleAdd} />;
      default: return null;
    }
  };

  return (
    <div>
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
