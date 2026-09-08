// src/taskpane/components/tabs/shared/ServiceSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import './ServiceSection.css';
import SelectBox from 'devextreme-react/select-box';
import { LeistungAuswahlResponse } from '@interfaces/IService';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setSelectedServiceId, setTime, setText, setSb, loadServicesAsync, clearServices } from '@slices/serviceSlice';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();

// Cap how many rows from the full catalog ever reach the dropdown's DOM at once.
// The catalog can hold thousands of entries; rendering all of them (even filtered
// down by a broad search term) is what made the add-in hang.
const MAX_DROPDOWN_RESULTS = 50;

// Unified interface for both Email and Service tabs
export interface ServiceSectionProps {}

const ServiceSection: React.FC<ServiceSectionProps> = () => {
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  const { t: translate } = useTranslation(['service', 'common']);
  
  // Get the service state from Redux store
  const serviceState = useAppSelector(state => state.service);
  
  // Get selected Akt from aktenSlice
  const selectedAkt = useAppSelector(state => state.akten.selectedAkt);
  const selectedAktKuerzel = selectedAkt?.aKurz;
  const selectedAktId = selectedAkt?.id;

  // Get the logged-in user's kürzel (set from the Pairing API once login/pairing resolves)
  const loggedInKuerzel = useAppSelector(state => state.auth.credentials.username);

  // What the user has typed into the dropdown's search box. Empty -> show the
  // small quick list; non-empty -> search falls through to the full catalog.
  const [searchValue, setSearchValue] = useState('');

  // Default the SB field to the logged-in user's kürzel once it's known,
  // as long as the field hasn't already been filled in (manually or otherwise)
  useEffect(() => {
    if (loggedInKuerzel && !serviceState.sb) {
      dispatch(setSb(loggedInKuerzel.toUpperCase()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInKuerzel]);

  // Reset the search box whenever a different Akt is selected
  useEffect(() => {
    setSearchValue('');
  }, [selectedAktId]);

  // Load both the quick list (shown by default) and the full catalog (used once the
  // user starts searching) whenever an Akt is selected. Both are cached separately.
  useEffect(() => {
    if (selectedAktId) {
      logger.debug('Loading services lists for Akt ' + selectedAktId, 'ServiceSection');
      dispatch(loadServicesAsync({ Kürzel: undefined, OnlyQuickListe: true, Count: undefined }));
      dispatch(loadServicesAsync({ Kürzel: undefined, OnlyQuickListe: false, Count: undefined }));
    } else {
      dispatch(clearServices());
    }
  }, [selectedAktId, dispatch]);

  // Handle value changes using Redux dispatch
  const handleServiceChange = (value: number) => {
    dispatch(setSelectedServiceId(value));
  };
  
  const handleTimeChange = (value: string) => {
    // Validate and format HH:MM input
    const timePattern = /^([0-9]{0,2}):?([0-9]{0,2})$/;
    const match = value.match(timePattern);
    
    if (match || value === '') {
      // Auto-format: add colon after 2 digits
      let formatted = value;
      if (value.length === 2 && !value.includes(':')) {
        formatted = value + ':';
      }
      dispatch(setTime(formatted));
    }
  };
  
  const handleTimeBlur = () => {
    const value = serviceState.time;
    if (!value || value.trim() === '') return;
    
    // Remove any existing colons and non-digits
    const digitsOnly = value.replace(/[^0-9]/g, '');
    
    if (digitsOnly === '') {
      dispatch(setTime(''));
      return;
    }
    
    let hours = 0;
    let minutes = 0;
    
    if (digitsOnly.length === 1) {
      // Single digit: treat as hours (e.g., "1" -> "01:00")
      hours = parseInt(digitsOnly);
    } else if (digitsOnly.length === 2) {
      // Two digits: treat as hours (e.g., "02" -> "02:00")
      hours = parseInt(digitsOnly);
    } else if (digitsOnly.length === 3) {
      // Three digits: first digit is hours, last two are minutes (e.g., "130" -> "01:30")
      hours = parseInt(digitsOnly.charAt(0));
      minutes = parseInt(digitsOnly.substring(1));
    } else if (digitsOnly.length >= 4) {
      // Four or more digits: first two are hours, next two are minutes (e.g., "0130" -> "01:30")
      hours = parseInt(digitsOnly.substring(0, 2));
      minutes = parseInt(digitsOnly.substring(2, 4));
    }
    
    // Validate and cap values
    hours = Math.min(Math.max(0, hours), 23);
    minutes = Math.min(Math.max(0, minutes), 59);
    
    // Format as HH:MM
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    dispatch(setTime(formatted));
  };
  
  const handleTextChange = (value: string) => {
    dispatch(setText(value));
  };
  
  // Create display text for services dropdown
  const getServiceDisplayText = (service: LeistungAuswahlResponse): string => {
    if (!service) return '';
    const parts = [service.stufe1, service.stufe2, service.stufe3].filter(Boolean);
    return parts.length > 0 ? parts.join(' > ') : `Service ${service.id}`;
  };

  // Transform services data to include display text. Memoized so this doesn't
  // re-run over the (potentially large) full catalog on every unrelated re-render
  // (typing SB/time/text, toggling the search box, etc.) — only when the lists
  // themselves change.
  const servicesWithDisplayText = useMemo(
    () => serviceState.services.map(service => ({ ...service, displayText: getServiceDisplayText(service) })),
    [serviceState.services]
  );
  const allServicesWithDisplayText = useMemo(
    () => serviceState.allServices.map(service => ({ ...service, displayText: getServiceDisplayText(service) })),
    [serviceState.allServices]
  );

  // While the box is empty, show the small quick list; as soon as the user types
  // something, search the full catalog instead. Also fall back to the full catalog
  // when the quick list turns out to be empty for this Akt, so the dropdown doesn't
  // falsely claim "no services available" while the full catalog has entries.
  const isSearching = searchValue.trim() !== '';
  const quickListEmpty = !serviceState.servicesLoading && serviceState.services.length === 0;
  const useFullCatalog = isSearching || quickListEmpty;

  // The full catalog can hold thousands of rows. Filtering it ourselves (rather than
  // handing the whole array to the SelectBox and letting its built-in search filter
  // it client-side) means the dropdown never has to render more than a capped number
  // of DOM rows, no matter how large the catalog or how broad the search term is.
  const matchingFullCatalog = useMemo(() => {
    if (!useFullCatalog) return [];
    const term = searchValue.trim().toLowerCase();
    if (!term) return allServicesWithDisplayText;
    return allServicesWithDisplayText.filter(service =>
      service.displayText.toLowerCase().includes(term) ||
      (service.kürzel || '').toLowerCase().includes(term)
    );
  }, [useFullCatalog, searchValue, allServicesWithDisplayText]);

  const activeServicesWithDisplayText = useFullCatalog
    ? matchingFullCatalog.slice(0, MAX_DROPDOWN_RESULTS)
    : servicesWithDisplayText;

  return (
    <div className="service-section-root">
      <h3>{translate('servicesHeading')}</h3>
      <div className="service-section-search-hint">{translate('typeToSearchHint')}</div>
      {!selectedAktKuerzel ? (
        <div className="service-section-placeholder">
          {translate('selectAktFirst')}
        </div>
      ) : serviceState.servicesLoading ? (
        <div>{translate('loadingServices')}</div>
      ) : serviceState.servicesError ? (
        <div className="service-section-error">{translate('common:errorPrefix')}: {serviceState.servicesError}</div>
      ) : (
        <>
          {/* Service dropdown - full width. Shows the quick list until the user searches,
              then searches the full catalog loaded in the background. */}
          <div className="service-section-field">
            <SelectBox
              stylingMode="outlined"
              dataSource={activeServicesWithDisplayText}
              value={activeServicesWithDisplayText.length > 0 ? serviceState.selectedServiceId : null}
              valueExpr="id"
              displayExpr="displayText"
              placeholder={activeServicesWithDisplayText.length > 0 ? translate('selectService') : translate('noServicesAvailable')}
              onValueChanged={e => handleServiceChange(e.value)}
              onOptionChanged={e => {
                if (e.name === 'searchValue') {
                  setSearchValue(e.value || '');
                }
              }}
              width="100%"
              disabled={serviceState.services.length === 0 && serviceState.allServices.length === 0}
              searchEnabled={true}
              searchExpr={['displayText', 'kürzel']}
              searchMode="contains"
            />
          </div>

          {/* Time and SB inputs - side by side */}
          <div className="service-section-inline-row">
            <input
              type="text"
              placeholder={translate('sbPlaceholder')}
              value={serviceState.sb}
              readOnly
              title={translate('sbLockedHint')}
              className="service-section-sb-input"
            />
            <input
              type="text"
              placeholder={translate('timePlaceholder')}
              value={serviceState.time}
              onChange={e => handleTimeChange(e.target.value)}
              onBlur={handleTimeBlur}
              maxLength={5}
              pattern="[0-9]{2}:[0-9]{2}"
              className="service-section-time-input"
            />
          </div>
          
          {/* Text input - full width */}
          <div className="service-section-field">
            <input
              type="text"
              placeholder={translate('textPlaceholder')}
              value={serviceState.text}
              onChange={e => handleTextChange(e.target.value)}
              className="service-section-text-input"
            />
          </div>
          
          {/* Show additional info */}
          <div className="service-section-hint">
            {translate('serviceContextHint')}
          </div>
        </>
      )}
    </div>
  );
};

export default ServiceSection;
