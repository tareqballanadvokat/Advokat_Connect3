import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import ServiceSection from '../shared/ServiceSection';
import SearchCaseList from '../shared/SearchCaseList';
import { setSelectedAkt } from '@store/slices/aktenSlice';
import { saveLeistungAsync, resetLoadCounter } from '@store/slices/serviceSlice';
import { getInternetMessageIdAsync, IsComposeMode } from '@hooks/useOfficeItem';
import { LeistungPostData } from '@components/interfaces/IService';
import { AktLookUpResponse } from '@components/interfaces/IAkten';
import notify from 'devextreme/ui/notify';
import RegisteredService from './RegisteredService';
import ServiceSend from './ServiceSend';
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus';
import { getLogger } from '../../../../services/logger';

const logger = getLogger();

const ServiceTabContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [transferLoading, setTransferLoading] = useState(false);
  
  const { selectedServiceId, time, text, sb, services } = useAppSelector(state => state.service);
  const { selectedAkt, cases } = useAppSelector(state => state.akten);
  
  // Derive case values from selectedAkt
  const selectedCaseId = selectedAkt?.id ?? -1;
  const selectedCaseName = selectedAkt?.aKurz ?? '';
  
  // Refresh trigger for registered services
  const [refreshFlag, setRefreshFlag] = React.useState(0);

  // Handler for case selection
  const setCaseHandler = (selectedCase: AktLookUpResponse) => {
    const isNewAkt = selectedAkt?.id !== selectedCase.id;
    
    // Dispatch the entire selected case object to aktenSlice
    dispatch(setSelectedAkt(selectedCase));
    
    if (isNewAkt) {
      // Different Akt: Reset counter to start fresh (cache first)
      dispatch(resetLoadCounter());
    } else {
      // Same Akt clicked again: Trigger refresh to force API call
      setRefreshFlag(f => f + 1);
    }
  };
  
  // Helper function to convert HH:MM to minutes
  const convertTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [hours, minutes] = timeStr.split(':').map(s => parseInt(s) || 0);
    return hours * 60 + minutes;
  };
  
  // Handler for sending service
  const sendServiceHandler = async () => {
    if (selectedCaseId === -1) {
      notify('Please select a case first', 'warning', 3000);
      return;
    }
    
    // Validate that either SB or time is provided (or both are empty)
    const hasSb = sb && sb.trim() !== '';
    const hasTime = time && time.trim() !== '';
    
    // If one is provided, both must be provided
    if ((hasSb && !hasTime) || (!hasSb && hasTime)) {
      notify('Please provide both SB and time, or leave both empty', 'error', 4000);
      return;
    }
    
    // Set loading state
    setTransferLoading(true);
    
    try {
      // Find the selected service to get its kürzel
      const selectedService = services.find(service => service.id === selectedServiceId);
      const serviceKuerzel = selectedService?.kürzel || selectedServiceId.toString();
      
      // Get Outlook email ID (only in read mode)
      const isCompose = IsComposeMode();
      let outlookEmailId: string | null = null;
      
      if (!isCompose) {
        try {
          const email = Office.context.mailbox.item;
          outlookEmailId = await getInternetMessageIdAsync(email);
          logger.debug('Saving Leistung with email ID: ' + outlookEmailId, 'ServiceTabContent');
        } catch (error) {
          logger.warn('Could not get email ID, saving without it', 'ServiceTabContent', error);
        }
      } else {
        logger.debug('Compose mode - saving Leistung without email ID', 'ServiceTabContent');
      }
      
      const timeInMinutes = convertTimeToMinutes(time);

      const sachbearbeiter = [];
      if (sb && sb.trim() !== '' && timeInMinutes !== null) {
        sachbearbeiter.push({
          sb: sb.trim(),
          zeitVerrechenbarInMinuten: timeInMinutes,
          zeitNichtVerrechenbarInMinuten: 0
        });
      }
      
      const payload: LeistungPostData = {
        aktId: selectedCaseId !== -1 ? selectedCaseId : null,
        aKurz: selectedCaseName || null,
        leistungKurz: serviceKuerzel,
        datum: new Date().toISOString(), // Current date in ISO format
        honorartext: text || null,
        memo: null,
        outlookEmailId: outlookEmailId,
        sachbearbeiter: sachbearbeiter.length > 0 ? sachbearbeiter : undefined
      };
      
      // Send to API via WebRTC using Redux thunk
      await dispatch(saveLeistungAsync(payload)).unwrap();
      notify('Service saved successfully', 'success', 3000);
      // Trigger refresh
      setRefreshFlag(f => f + 1);
      
    } catch (error) {
      logger.error('Failed to save service:', 'ServiceTabContent', error);
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
        onTransfer={sendServiceHandler}
        transferBtnDisable={!selectedAkt || selectedServiceId === 0}
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
