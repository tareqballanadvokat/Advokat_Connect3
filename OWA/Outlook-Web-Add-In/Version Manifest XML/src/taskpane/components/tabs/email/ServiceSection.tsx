// src/taskpane/components/tabs/email/ServiceSection.tsx
import React from 'react';
import SelectBox from 'devextreme-react/select-box';
import { Abbreviation } from '@components/interfaces/ICommon';
import { useGetAbbreviationsQuery } from '@store/services/abbreviationApi';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setAbbreviation, setTime, setText, setSb } from '@store/slices/serviceSlice';
import { updateTransferCaseDisableState } from '@store/slices/emailSlice';

// Simple interface with no props needed since we use Redux
export interface ServiceSectionProps {}

const ServiceSection: React.FC<ServiceSectionProps> = () => {
  // Use RTK Query hook to fetch abbreviations
  const { data: options = [], isLoading, error } = useGetAbbreviationsQuery();
  
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  
  // Get the service state from Redux store
  const serviceState = useAppSelector(state => state.service);
  
  // Handle value changes using Redux dispatch
  const handleAbbreviationChange = (value: string) => {
    dispatch(setAbbreviation(Number(value)));
    dispatch(updateTransferCaseDisableState());
  };
  
  const handleTimeChange = (value: string) => {
    dispatch(setTime(value));
    dispatch(updateTransferCaseDisableState());
  };
  
  const handleTextChange = (value: string) => {
    dispatch(setText(value));
    dispatch(updateTransferCaseDisableState());
  };
  
  const handleSbChange = (value: string) => {
    dispatch(setSb(value));
    dispatch(updateTransferCaseDisableState());
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3>Services</h3>
      {isLoading ? (
        <div>Loading abbreviations...</div>
      ) : error ? (
        <div>Error loading abbreviations</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <SelectBox
              stylingMode="outlined"
              dataSource={options}
              value={serviceState.abbreviation.toString()}
              valueExpr="id"
              displayExpr="name"
              placeholder="Abbreviation"
              onValueChanged={e => handleAbbreviationChange(e.value)}
              width={130}
            />
            <input
              type="text"
              placeholder="SB"
              value={serviceState.sb}
              onChange={e => handleSbChange(e.target.value)}
              style={{
                width: 25,
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
                width: 40,
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          </div>
          <input
            type="text"
            placeholder="Text"
            value={serviceState.text}
            onChange={e => handleTextChange(e.target.value)}
            style={{
              width: 262,
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
        </>
      )}
    </div>
  );
};

export default ServiceSection;
