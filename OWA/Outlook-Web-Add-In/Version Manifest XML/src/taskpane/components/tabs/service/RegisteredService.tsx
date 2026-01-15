// src/taskpane/components/tabs/email/RegisteredEmails.tsx
import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { configService } from '../../../../config/index';

interface ServiceRecord {
  id: string;
  date: string;
  subject: string;
}

interface RegisteredServiceProps {
  /** Z każdą zmianą odświeża listę */
  refreshTrigger?: any;
}

const RegisteredService: React.FC<RegisteredServiceProps> = ({ refreshTrigger }) => {
  const [emails, setEmails] = useState<ServiceRecord[]>([]);

  useEffect(() => {
    (async () => {
      try {
    
        // const resp = await fetch(configService.getApiUrl('api/service/get-services'), {
        //   method: 'GET',
        //   headers: { 'Content-Type': 'application/json' }
        // });
        // const data: ServiceRecord[] = await resp.json();
        // // Zakładamy, że zwracane entries są już posortowane malejąco po dacie.
        // setEmails(data);
      } catch (err) {
        console.error('Błąd podczas pobierania zarejestowanych akcji servisowych:', err);
      }
    })();
}, [refreshTrigger]);

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{  alignItems: 'baseline', gap: 8 }}>
        Registered Services (last 7 days) 
      </h3>

      <DataGrid
        dataSource={emails}
        keyExpr="id"
        showBorders={false}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText="No service found"
        height={250}
      >
        <Paging defaultPageSize={7} />
        <Pager
          visible
          showPageSizeSelector={false}
          allowedPageSizes={[7]}
          showInfo
        />
        <Column
          dataField="insertDate"
          caption="Date"
          dataType="date"
          format="yyyy-MM-dd"
          alignment="left"
        />
        <Column
          dataField="serviceText"
          caption="Text"  
          alignment="left"
        />
        <Column
          dataField="serviceSB"
          caption="SB"
          alignment="left"
        />
      </DataGrid>
    </div>
  );
};

export default RegisteredService;
