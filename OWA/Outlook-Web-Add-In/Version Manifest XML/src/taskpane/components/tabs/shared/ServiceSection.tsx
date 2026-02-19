// src/taskpane/components/tabs/shared/ServiceSection.tsx
import React, { useEffect } from 'react';
import SelectBox from 'devextreme-react/select-box';
import { LeistungAuswahlResponse } from '@components/interfaces/IService';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setSelectedServiceId, setTime, setText, setSb, loadServicesAsync, clearServices } from '@store/slices/serviceSlice';
import notify from 'devextreme/ui/notify';
import { getLogger } from '../../../../services/logger';

const logger = getLogger();

// Unified interface for both Email and Service tabs
export interface ServiceSectionProps {}

const ServiceSection: React.FC<ServiceSectionProps> = () => {
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  
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
        OnlyQuickListe: true,
        Limit: null
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
      notify('SB must be exactly 3 letters', 'error', 3000);
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
    <div style={{ marginBottom: 24 }}>
  <h3>Services</h3>
      {!selectedAktKuerzel ? (
        <div style={{ color: '#666', fontStyle: 'italic' }}>
          Please select an Akt to load services
        </div>
      ) : serviceState.servicesLoading ? (
        <div>Loading services...</div>
      ) : serviceState.servicesError ? (
        <div style={{ color: 'red' }}>Error: {serviceState.servicesError}</div>
      ) : (
        <>
          {/* Service dropdown - full width */}
          <div style={{ marginBottom: 8 }}>
            <SelectBox
              stylingMode="outlined"
              dataSource={servicesWithDisplayText}
              value={serviceState.services.length > 0 ? serviceState.selectedServiceId : null}
              valueExpr="id"
              displayExpr="displayText"
              placeholder={serviceState.services.length > 0 ? "Select Service" : "No services available"}
              onValueChanged={e => handleServiceChange(e.value)}
              width="100%"
              disabled={serviceState.services.length === 0}
            />
          </div>
          
          {/* Time and SB inputs - side by side */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="SB"
              value={serviceState.sb}
              onChange={e => handleSbChange(e.target.value)}
              onBlur={handleSbBlur}
              maxLength={3}
              pattern="[A-Za-z]{0,3}"
              style={{
                width: 50,
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #ccc',
                borderRadius: 4,
                textAlign: 'center',
                backgroundColor: '#f4f4f4',
                textTransform: 'uppercase'
              }}
            />
            <input
              type="text"
              placeholder="HH:MM"
              value={serviceState.time}
              onChange={e => handleTimeChange(e.target.value)}
              onBlur={handleTimeBlur}
              maxLength={5}
              pattern="[0-9]{2}:[0-9]{2}"
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          </div>
          
          {/* Text input - full width */}
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Text"
              value={serviceState.text}
              onChange={e => handleTextChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #ccc',
                borderRadius: 4,
                boxSizing: 'border-box',
              }}
            />
          </div>
          
          {/* Show additional info */}
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            Select a service. It will be handled according to the current context (email or service).
          </div>
        </>
      )}
    </div>
  );
};

export default ServiceSection;
