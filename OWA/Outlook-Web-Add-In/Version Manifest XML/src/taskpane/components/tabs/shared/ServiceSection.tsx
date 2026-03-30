// src/taskpane/components/tabs/shared/ServiceSection.tsx
import React, { useEffect } from 'react';
import './ServiceSection.css';
import SelectBox from 'devextreme-react/select-box';
import { LeistungAuswahlResponse } from '@interfaces/IService';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setSelectedServiceId, setTime, setText, setSb, loadServicesAsync, clearServices } from '@slices/serviceSlice';
import notify from 'devextreme/ui/notify';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();

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

  // Load services whenever an Akt is selected (uses cache after first load)
  useEffect(() => {
    if (selectedAktId) {
      logger.debug('Loading global services list for Akt ' + selectedAktId, 'ServiceSection');
      dispatch(loadServicesAsync({
        Kürzel: null,
         OnlyQuickListe: false,
        Count: null
      }));
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
  
  const handleSbChange = (value: string) => {
    // Allow empty or only letters (max 3)
    if (value === '' || /^[a-zA-Z]{0,3}$/.test(value)) {
      dispatch(setSb(value.toUpperCase()));
    }
  };
  
  const handleSbBlur = () => {
    const value = serviceState.sb;
    // If not empty and not exactly 3 letters, show error
    if (value && value.length !== 3) {
      notify(translate('sbValidationError'), 'error', 3000);
    }
  };

  // Create display text for services dropdown
  const getServiceDisplayText = (service: LeistungAuswahlResponse): string => {
    if (!service) return '';
    const parts = [service.stufe1, service.stufe2, service.stufe3].filter(Boolean);
    return parts.length > 0 ? parts.join(' > ') : `Service ${service.id}`;
  };
  // Transform services data to include display text
  const servicesWithDisplayText = serviceState.services.map(service => ({
    ...service,
    displayText: getServiceDisplayText(service)
  }));

  return (
    <div className="service-section-root">
      <h3>{translate('servicesHeading')}</h3>
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
          {/* Service dropdown - full width */}
          <div className="service-section-field">
            <SelectBox
              stylingMode="outlined"
              dataSource={servicesWithDisplayText}
              value={serviceState.services.length > 0 ? serviceState.selectedServiceId : null}
              valueExpr="id"
              displayExpr="displayText"
              placeholder={serviceState.services.length > 0 ? translate('selectService') : translate('noServicesAvailable')}
              onValueChanged={e => handleServiceChange(e.value)}
              width="100%"
              disabled={serviceState.services.length === 0}
            />
          </div>
          
          {/* Time and SB inputs - side by side */}
          <div className="service-section-inline-row">
            <input
              type="text"
              placeholder={translate('sbPlaceholder')}
              value={serviceState.sb}
              onChange={e => handleSbChange(e.target.value)}
              onBlur={handleSbBlur}
              maxLength={3}
              pattern="[A-Za-z]{0,3}"
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
