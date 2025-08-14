// src/taskpane/components/tabs/service/ServiceSection.tsx
import React from 'react';
import SelectBox from 'devextreme-react/select-box';
import { useGetAbbreviationsQuery } from '@store/services/abbreviationApi';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { setAbbreviation, setTime, setText, setSb } from '@store/slices/serviceSlice';
import { ServiceSectionProps } from '@components/interfaces/IService';

// Pure Redux-based component using interface
const ServiceSection: React.FC<ServiceSectionProps> = () => {
  // Use RTK Query hook to fetch abbreviations
  const { data: options = [], isLoading, error } = useGetAbbreviationsQuery();
  
  // Get Redux dispatch function
  const dispatch = useAppDispatch();
  
  // Get the service state from Redux store
  const { abbreviation, time, text, sb } = useAppSelector(state => state.service);

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
              value={abbreviation}
              valueExpr="id"
              displayExpr="name"
              placeholder="Abbreviation"
              onValueChanged={e => dispatch(setAbbreviation(Number(e.value)))}
              width={130}
            />
            <input
              type="text"
              placeholder="SB"
              value={sb}
              onChange={e => dispatch(setSb(e.target.value))}
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
              value={time}
              onChange={e => dispatch(setTime(e.target.value))}
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
            value={text}
            onChange={e => dispatch(setText(e.target.value))}
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
