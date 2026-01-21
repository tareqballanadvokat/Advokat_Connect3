// src/taskpane/components/tabs/email/RegisteredEmails.tsx
import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import {RegisteredEmail} from '../../interfaces/IEmail'
import { configService } from '../../../../config/index';


const RegisteredEmails: React.FC = () => {
  const [emails, setEmails] = useState<RegisteredEmail[]>([]);

  // useEffect(() => {
  //   (async () => {
  //     try {
  //       const resp = await fetch(configService.getApiUrl('api/email/get-registered'), {
  //         method: 'GET',
  //         headers: { 'Content-Type': 'application/json' }
  //       });
  //       const data: RegisteredEmail[] = await resp.json();
  //       // Zakładamy, że zwracane entries są już posortowane malejąco po dacie.
  //       setEmails(data);
  //     } catch (err) {
  //       console.error('Błąd podczas pobierania Registered E-Mails:', err);
  //     }
  //   })();
  // }, []);

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{  alignItems: 'baseline', gap: 8 }}>
        Registered E-Mails (last 7 days)
      </h3>

      <DataGrid
        dataSource={emails}
        keyExpr="id"
        showBorders={false}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText="No e-mails found"
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
          dataField="id"
          caption="Id"
          dataType="string" 
        />
        <Column
          dataField="insertDate"
          caption="Date"
          dataType="date"
          format="yyyy-MM-dd"
          alignment="left"
        />
        <Column
          dataField="emailName"
          caption="Subject"
          alignment="left"
        />
      </DataGrid>
    </div>
  );
};

export default RegisteredEmails;
