// src/taskpane/components/tabs/shared/ServiceSection.tsx
import React, { useEffect } from 'react';
import SelectBox from 'devextreme-react/select-box';
import { LeistungAuswahlResponse } from '@components/interfaces/IService';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setAbbreviation, setTime, setText, setSb, loadServicesAsync, clearServices } from '@store/slices/serviceSlice';
import { updateTransferCaseDisableState } from '@store/slices/emailSlice';

// Unified interface for both Email and Service tabs
export interface ServiceSectionProps {
  selectedAktKuerzel?: string; // The Kürzel of the selected Akt
  mode?: 'email' | 'service';  // Mode determines behavior differences
}

const ServiceSection: React.FC<ServiceSectionProps> = ({ 
  selectedAktKuerzel, 
  mode = 'service' 
}) => {
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  
  // Get the service state from Redux store
  const serviceState = useAppSelector(state => state.service);
  
  // Load services when selectedAktKuerzel changes (but only if needed)
  useEffect(() => {
    if (selectedAktKuerzel) {
      // Only load services if we don't have them for this Akt already
      if (serviceState.currentAktKuerzel !== selectedAktKuerzel) {
        console.log(`Loading services for Akt: ${selectedAktKuerzel} (${mode} mode) - not cached`);
        // Clear current service selection when Akt changes
        dispatch(setAbbreviation(0));
        // Load new services
        dispatch(loadServicesAsync({
          Kürzel: selectedAktKuerzel,
          OnlyQuickListe: true, // Only show services marked for quick list
          Limit: 50 // Reasonable limit for dropdown
        }));
      } else {
        console.log(`Using cached services for Akt: ${selectedAktKuerzel} (${mode} mode)`);
        // Still clear service selection when switching tabs/modes for same Akt
        dispatch(setAbbreviation(0));
      }
    } else {
      // Clear services when no Akt is selected
      dispatch(clearServices());
    }
  }, [selectedAktKuerzel, dispatch, mode, serviceState.currentAktKuerzel]);
  
  // Handle value changes using Redux dispatch
  const handleServiceChange = (value: number) => {
    dispatch(setAbbreviation(value));
    // Only update transfer state in email mode (where email attachments matter)
    if (mode === 'email') {
      dispatch(updateTransferCaseDisableState());
    }
  };
  
  const handleTimeChange = (value: string) => {
    dispatch(setTime(value));
    if (mode === 'email') {
      dispatch(updateTransferCaseDisableState());
    }
  };
  
  const handleTextChange = (value: string) => {
    dispatch(setText(value));
    if (mode === 'email') {
      dispatch(updateTransferCaseDisableState());
    }
  };
  
  const handleSbChange = (value: string) => {
    dispatch(setSb(value));
    if (mode === 'email') {
      dispatch(updateTransferCaseDisableState());
    }
  };

  // Create display text for services dropdown
  const getServiceDisplayText = (service: LeistungAuswahlResponse): string => {
    if (!service) return '';
    const parts = [service.Stufe1, service.Stufe2, service.Stufe3].filter(Boolean);
    return parts.length > 0 ? parts.join(' > ') : `Service ${service.Id}`;
  };

  // Transform services data to include display text
  const servicesWithDisplayText = serviceState.services.map(service => ({
    ...service,
    displayText: getServiceDisplayText(service)
  }));

  return (
    <div style={{ marginBottom: 24 }}>
      <h3>Services {mode === 'email' ? '(with Email Transfer)' : ''}</h3>
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
              value={serviceState.services.length > 0 ? serviceState.abbreviation : null}
              valueExpr="Id"
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
          
          {/* Show additional info based on mode */}
          {mode === 'email' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              Service will be transferred with email and attachments
            </div>
          )}
          {mode === 'service' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              Service will be registered without email attachments
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ServiceSection;
