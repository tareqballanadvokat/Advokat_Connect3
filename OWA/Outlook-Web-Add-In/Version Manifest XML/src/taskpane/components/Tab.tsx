import React, { useState, Suspense, lazy, useEffect } from 'react';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';
import { ENABLE_CACHE_STATS } from '@config';
import { getLogger } from '@services/logger';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setLanguage, SupportedLanguage } from '@slices/languageSlice';

const logger = getLogger();
// lazy-import
const ServiceTab = lazy(() => import('./tabs/service/ServiceTabContent'));
const EmailTab  = lazy(() => import('./tabs/email/EmailTabContent'));
const PersonTab  = lazy(() => import('./tabs/person/PersonTabContent'));
const CaseTabContent = lazy(() => import('./tabs/case/CaseTabContent'));
const CacheStatsPanel = lazy(() => import('./tabs/shared/CacheStatsPanel'));

const DevTabs: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCacheTab, setShowCacheTab] = useState(ENABLE_CACHE_STATS);
  const { t: translate } = useTranslation('common');
  const dispatch = useAppDispatch();
  const lang = useAppSelector(state => state.language.lang);
  const switchLang = (l: SupportedLanguage) => dispatch(setLanguage(l));

  // Keyboard shortcut: Ctrl+Shift+C to toggle cache tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setShowCacheTab(prev => {
          const newState = !prev;
          logger.debug(`Cache stats tab ${newState ? 'enabled' : 'disabled'} via keyboard shortcut`, 'Tab');
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
          logger.warn('Cache stats tab not available', 'Tab');
          return <div style={{ padding: '20px' }}>{translate('cacheNotAvailable')}</div>;
        }
        return <CacheStatsPanel />;
      default: return null;
    }
  };

  return (
    <div className="dx-compact">
      {/* Language switcher */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, padding: '4px 4px 0' }}>
        <button
          type="button"
          onClick={() => switchLang('de')}
          style={{
            padding: '2px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
            border: lang === 'de' ? '1px solid #0078d4' : '1px solid #ccc',
            background: lang === 'de' ? '#0078d4' : 'transparent',
            color: lang === 'de' ? '#fff' : 'inherit',
          }}
        >DE</button>
        <button
          type="button"
          onClick={() => switchLang('en')}
          style={{
            padding: '2px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
            border: lang === 'en' ? '1px solid #0078d4' : '1px solid #ccc',
            background: lang === 'en' ? '#0078d4' : 'transparent',
            color: lang === 'en' ? '#fff' : 'inherit',
          }}
        >EN</button>
      </div>
      <Tabs
        width="100%"
        selectedIndex={selectedIndex}
        onItemClick={e => setSelectedIndex(e.itemIndex)}
       
        showNavButtons={false}
      >
        <Item text={translate('tabs.email')} />
        <Item text={translate('tabs.service')} />
        <Item text={translate('tabs.case')} />
        <Item text={translate('tabs.person')} />
        {showCacheTab && <Item text={translate('tabs.cache')} />}
      </Tabs>

      {/* Suspense pokaże fallback tylko przy pierwszym ładowaniu chunka */}
      <div style={{ marginTop: 16 }}>
        <Suspense fallback={<div>{translate('loadingTab')}</div>}>
          {renderContent()}
        </Suspense>
      </div>
    </div>
  );
};

export default DevTabs;
