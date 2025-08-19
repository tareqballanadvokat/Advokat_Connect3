// src/taskpane/components/tabs/service/ServiceTabContent.tsx
import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import ServiceSection from '../shared/ServiceSection';
import SearchCaseList from '../email/SearchCaseList';
import { setSelectedCase, updateTransferCaseDisableState } from '@store/slices/emailSlice';
import { saveServiceInformation } from '@utils/api';
import { getInternetMessageIdAsync } from '@hooks/useOfficeItem';
import { ServiceModel, LeistungPostData } from '@components/interfaces/IService';
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
  const { abbreviation, time, text, sb } = useAppSelector(state => state.service);
  const { selectedCaseId, selectedCaseName, selectedCaseDisable, transferCaseDisable } = useAppSelector(state => state.email);
  
  // Refresh trigger for registered services
  const [refreshFlag, setRefreshFlag] = React.useState(0);

  // Handler for case selection
  const setCaseHandler = (id: string, name: string) => {
    dispatch(setSelectedCase({
      id: Number.parseInt(id),
      name: name
    }));
    dispatch(updateTransferCaseDisableState());
  };
  
  // Handler for case name change
  const handleCaseChange = (value: string) => {
    dispatch(setSelectedCase({
      id: selectedCaseId,
      name: value
    }));
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
      // Create payload using LeistungPostData interface matching C# model
      const payload: LeistungPostData = {
        AktId: selectedCaseId,
        AKurz: selectedCaseName,
        LeistungKurz: abbreviation.toString(),
        Datum: new Date().toISOString(), // Current date in ISO format
        Honorartext: text || undefined,
        Memo: text || undefined,
        SBZeitVerrechenbarInMinuten: time ? parseInt(time) : undefined,
        SBZeitNichtVerrechenbarInMinuten: undefined
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
        throw new Error(response.error || 'Failed to save service');
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
        caseIdDisable={selectedCaseDisable}
        transferBtnDisable={transferCaseDisable}
        transferLoading={transferLoading}
      />
      
      {/* Service Section in service mode (no email attachments) */}
      <ServiceSection selectedAktKuerzel={selectedCaseName} mode="service" />
      
      {/* Registered Services */}
      <RegisteredService refreshTrigger={refreshFlag} />
    </div>
  );
};

export default ServiceTabContent;
