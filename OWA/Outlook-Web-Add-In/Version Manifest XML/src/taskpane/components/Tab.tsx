import React, { useState, Suspense, lazy, useEffect, useRef } from 'react';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';
import { ENABLE_CACHE_STATS } from '../../config';
// lazy-import
const ServiceTab = lazy(() => import('./tabs/service/ServiceTabContent'));
const EmailTab  = lazy(() => import('./tabs/email/EmailTabContent'));
const PersonTab  = lazy(() => import('./tabs/person/PersonTabContent'));
const CaseTabContent = lazy(() => import('./tabs/case/CaseTabContent'));
const CacheStatsPanel = lazy(() => import('./shared/CacheStatsPanel'));

const DevTabs: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCacheTab, setShowCacheTab] = useState(ENABLE_CACHE_STATS);

  // Keyboard shortcut: Ctrl+Shift+C to toggle cache tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setShowCacheTab(prev => {
          const newState = !prev;
          console.log(`🔑 [Tab] Cache stats tab ${newState ? 'enabled' : 'disabled'} via keyboard shortcut`);
          return newState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderContent = () => {
    switch (selectedIndex) {
      case 0: return <EmailTab />;
      case 1: return <ServiceTab />;
      case 2: return <CaseTabContent />;
      case 3: return <PersonTab />;
      case 4: 
        if (!showCacheTab) {
          console.warn('[Tab] Cache stats tab not available');
          return <div style={{ padding: '20px' }}>Cache Statistics not available</div>;
        }
        return <CacheStatsPanel />;
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
        {showCacheTab && <Item text="Cache" />}
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
