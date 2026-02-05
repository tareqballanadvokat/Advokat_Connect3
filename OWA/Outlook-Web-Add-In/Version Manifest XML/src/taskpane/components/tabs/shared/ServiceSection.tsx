// src/taskpane/components/tabs/shared/ServiceSection.tsx
import React, { useEffect } from 'react';
import SelectBox from 'devextreme-react/select-box';
import { LeistungAuswahlResponse } from '@components/interfaces/IService';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setSelectedServiceId, setTime, setText, setSb, loadServicesAsync, clearServices } from '@store/slices/serviceSlice';

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

  // Load services once when component mounts (services list is global, not per-Akt)
  useEffect(() => {
    const servicesEmpty = serviceState.services.length === 0;

    if (selectedAktKuerzel && servicesEmpty) {
      console.log('Loading global services list');
      dispatch(loadServicesAsync({
        Kürzel: null,
        OnlyQuickListe: true,
        Limit: null
      }));
    } else if (!selectedAktKuerzel) {
      dispatch(clearServices());
    }
  }, [selectedAktKuerzel, dispatch, serviceState.services.length]);
  
  // Handle value changes using Redux dispatch
  const handleServiceChange = (value: number) => {
    dispatch(setSelectedServiceId(value));
  };
  
  const handleTimeChange = (value: string) => {
    dispatch(setTime(value));
  };
  
  const handleTextChange = (value: string) => {
    dispatch(setText(value));
  };
  
  const handleSbChange = (value: string) => {
    dispatch(setSb(value));
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
              style={{
                width: 50,
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #ccc',
                borderRadius: 4,
                textAlign: 'center',
                backgroundColor: '#f4f4f4',
              }}
            />
            <input
              type="text"
              placeholder="Time"
              value={serviceState.time}
              onChange={e => handleTimeChange(e.target.value)}
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
