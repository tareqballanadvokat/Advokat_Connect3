import React, { useState, Suspense, lazy, useEffect } from 'react';
import Tabs, { Item } from 'devextreme-react/tabs';
import 'devextreme/dist/css/dx.light.css';
import { ENABLE_CACHE_STATS, isDevelopment } from '@config';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setLanguage, SupportedLanguage } from '@slices/languageSlice';
import { selectSelectedCandidateType, SelectedCandidateType } from '@slices/connectionSlice';

const logger = getLogger();

/** Map candidate type to a short display label */
function iceBadgeLabel(type: SelectedCandidateType | undefined): string {
  switch (type) {
    case 'mdns':   return 'mDNS';
    case 'direct': return 'Direct';
    case 'stun':   return 'STUN';
    case 'turn':   return 'TURN';
    default:       return '—';
  }
}

const ICE_BADGE_COLORS: Record<string, string> = {
  mdns:    '#107c10', // green  — local P2P via mDNS
  direct:  '#107c10', // green  — local P2P via LAN IP
  stun:    '#ff8c00', // orange — STUN (server reflexive)
  turn:    '#d83b01', // red    — TURN relay
};

/** Inline style for the ICE badge chip */
function iceBadgeStyle(type: SelectedCandidateType | undefined): React.CSSProperties {
  const color = type ? (ICE_BADGE_COLORS[type] ?? '#666') : '#aaa';
  return {
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 8,
    border: `1px solid ${color}`,
    color,
    background: `${color}18`,
    letterSpacing: '0.03em',
    userSelect: 'none' as const,
  };
}

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
  const selectedCandidateType = useAppSelector(selectSelectedCandidateType);

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
      {/* Dev-only: ICE candidate type indicator */}
      {/* {isDevelopment() && ( */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '2px 4px 0', gap: 4 }}>
          <span style={{ fontSize: 15, color: '#666' }}>ICE:</span>
          <span style={iceBadgeStyle(selectedCandidateType)}>
            {iceBadgeLabel(selectedCandidateType)}
          </span>
        </div>
      {/* )} */}
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

      {/* Suspense pokaze fallback tylko przy pierwszym ladowaniu chunka */}
      <div style={{ marginTop: 16 }}>
        <Suspense fallback={<div>{translate('loadingTab')}</div>}>
          {renderContent()}
        </Suspense>
      </div>
    </div>
  );
};

export default DevTabs;
