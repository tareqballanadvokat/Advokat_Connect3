// src/taskpane/components/tabs/service/ServiceTabContent.tsx
import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import ServiceSection from '../shared/ServiceSection';
import SearchCaseList from '../shared/SearchCaseList';
import { setSelectedAkt } from '@store/slices/aktenSlice';
import { getInternetMessageIdAsync } from '@hooks/useOfficeItem';
import { LeistungPostData } from '@components/interfaces/IService';
import { AktLookUpResponse } from '@components/interfaces/IAkten';
import { webRTCApiService } from '../../../services/webRTCApiService';
import notify from 'devextreme/ui/notify';
import RegisteredService from './RegisteredService';
import ServiceSend from './ServiceSend';
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus';

const ServiceTabContent: React.FC = () => {
  const dispatch = useAppDispatch();
  
  // Local state for transfer loading
  const [transferLoading, setTransferLoading] = useState(false);
  
  // Get the relevant state from Redux
  const { selectedServiceId, time, text, sb, services } = useAppSelector(state => state.service);
  const { selectedAkt, cases } = useAppSelector(state => state.akten);
  
  // Derive case values from selectedAkt
  const selectedCaseId = selectedAkt?.id ?? -1;
  const selectedCaseName = selectedAkt?.aKurz ?? '';
  
  // Refresh trigger for registered services
  const [refreshFlag, setRefreshFlag] = React.useState(0);

  // Handler for case selection
  const setCaseHandler = (selectedCase: AktLookUpResponse) => {
    // Dispatch the entire selected case object to aktenSlice
    dispatch(setSelectedAkt(selectedCase));
  };
  
  // Handler for case name change
  const handleCaseChange = (value: string) => {
    // Update the selected Akt name (aKurz) in the current selectedAkt
    if (selectedAkt) {
      dispatch(setSelectedAkt({ ...selectedAkt, aKurz: value }));
    }
  };
  
  // Handler for sending service
  const sendServiceHandler = async () => {
    if (selectedCaseId === -1) {
      notify('Please select a case first', 'warning', 3000);
      return;
    }
    
    // Set loading state
    setTransferLoading(true);
    
    try {
      // Find the selected service to get its kürzel
      const selectedService = services.find(service => service.id === selectedServiceId);
      const serviceKuerzel = selectedService?.kürzel || selectedServiceId.toString();
      
      // Create payload using LeistungPostData interface matching C# model
      const payload: LeistungPostData = {
        aktId: selectedCaseId !== -1 ? selectedCaseId : null,
        aKurz: selectedCaseName || null,
        leistungKurz: serviceKuerzel,
        datum: new Date().toISOString(), // Current date in ISO format
        honorartext: text || null,
        memo: null,
        sbZeitVerrechenbarInMinuten: time ? parseInt(time) : null,
        sbZeitNichtVerrechenbarInMinuten: 0
      };
      
      // Check if WebRTC connection is ready
      if (!webRTCApiService.isReady()) {
        notify('WebRTC connection not available. Please ensure connection is established.', 'warning', 5000);
        return;
      }
      
      // Send to API via WebRTC
      const response = await webRTCApiService.saveLeistung(payload);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        notify('Service saved successfully', 'success', 3000);
        // Trigger refresh
        setRefreshFlag(f => f + 1);
      } else {
        throw new Error('Failed to save service');
      }
      
    } catch (error) {
      console.error('Failed to save service:', error);
      notify('Failed to save service', 'error', 5000);
    } finally {
      // Reset loading state
      setTransferLoading(false);
    }
  };
  
  return (
    <div>
      {/* WebRTC Connection Status */}
      <WebRTCConnectionStatus />
      
      {/* Case Search */}
      <SearchCaseList onCaseSelect={setCaseHandler} />
      
      {/* Service Send Button */}
      <ServiceSend
        caseId={selectedCaseName}
        onCaseChange={handleCaseChange}
        onTransfer={sendServiceHandler}
        caseIdDisable={!selectedAkt}
        transferBtnDisable={!selectedAkt}
        transferLoading={transferLoading}
      />
      
  {/* Service Section */}
  <ServiceSection />
      
      {/* Registered Services */}
      <RegisteredService refreshTrigger={refreshFlag} />
    </div>
  );
};

export default ServiceTabContent;
