// src/taskpane/components/tabs/email/RegisteredEmails.tsx
import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { DokumentArt, DokumentResponse } from '../../interfaces/IDocument';
import { getWebRTCConnectionManager } from '../../../services/WebRTCConnectionManager';
import { useAppSelector } from '../../../../store/hooks';
import { selectAuthCredentials } from '../../../../store/slices/authSlice';


const RegisteredEmails: React.FC = () => {
  const [emails, setEmails] = useState<DokumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credentials = useAppSelector(selectAuthCredentials);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const erstelltAb = new Date();
        erstelltAb.setDate(erstelltAb.getDate() - 7);

        const connectionManager = getWebRTCConnectionManager();
        const webRTCApiService = connectionManager.getWebRTCApiService();
        const response = await webRTCApiService.GetDocuments({
          dokumentArten: [DokumentArt.MailEmpfangen, DokumentArt.MailGesendet],
          erstelltAb,
          erstelltVon: credentials?.username,
        });

        if (response.statusCode === 200) {
          const data = JSON.parse(response.body || '[]') as DokumentResponse[];
          setEmails(data);
        } else {
          setError('Failed to load registered e-mails.');
        }
      } catch (err) {
        setError('Error fetching registered e-mails.');
        console.error('RegisteredEmails fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ alignItems: 'baseline', gap: 8 }}>
        Registered E-Mails (last 7 days)
      </h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <DataGrid
        dataSource={emails}
        keyExpr="id"
        showBorders={false}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText={loading ? 'Loading...' : 'No e-mails found'}
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
          dataType="number"
          width={60}
        />
        <Column
          dataField="datum"
          caption="Date"
          dataType="date"
          format="yyyy-MM-dd"
          alignment="left"
        />
        <Column
          dataField="betreff"
          caption="Subject"
          alignment="left"
        />
      </DataGrid>
    </div>
  );
};

export default RegisteredEmails;
