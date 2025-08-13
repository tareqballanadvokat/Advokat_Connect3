// src/taskpane/components/tabs/service/ServiceTabContent.tsx
import React from 'react';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import ServiceSection from './ServiceSection';
import SearchCaseList from '../email/SearchCaseList';
import { setSelectedCase } from '../../../../store/slices/emailSlice';
import { saveServiceInformation } from '../../../utils/api';
import { getInternetMessageIdAsync } from '../../../hooks/useOfficeItem';
import notify from 'devextreme/ui/notify';
import RegisteredService from './RegisteredService';
import { updateTransferCaseDisableState } from '../../../../store/slices/emailSlice';
import ServiceSend from '../email/EmailSend';

const ServiceTabContent: React.FC = () => {
  const dispatch = useAppDispatch();
  
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
    dispatch(updateTransferCaseDisableState(undefined));
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
    
    try {
      // Get message ID for reference (if needed)
      const email = Office.context.mailbox.item;
      const messageId = await getInternetMessageIdAsync(email);
      
      // Create payload
      const payload = {
        caseId: selectedCaseId,
        serviceAbbreviationType: abbreviation.toString(),
        serviceSB: sb,
        serviceTime: time,
        serviceText: text,
        internetMessageId: messageId,
        userId: 1
      };
      
      // Send to API
      await saveServiceInformation(payload);
      notify('Service saved successfully', 'success', 3000);
      
      // Trigger refresh
      setRefreshFlag(f => f + 1);
    } catch (error) {
      console.error('Failed to save service:', error);
      notify('Failed to save service', 'error', 5000);
    }
  };
  
  return (
    <div>
      {/* Case Search */}
      <SearchCaseList onCaseSelect={setCaseHandler} />
      
      {/* Service Send Button */}
      <ServiceSend
        caseId={selectedCaseName}
        onCaseChange={handleCaseChange}
        onTransfer={sendServiceHandler}
        caseIdDisable={selectedCaseDisable}
        transferBtnDisable={transferCaseDisable}
      />
      
      {/* Service Section using Redux version */}
      <ServiceSection />
      
      {/* Registered Services */}
      <RegisteredService refreshTrigger={refreshFlag} />
    </div>
  );
};

export default ServiceTabContent;
