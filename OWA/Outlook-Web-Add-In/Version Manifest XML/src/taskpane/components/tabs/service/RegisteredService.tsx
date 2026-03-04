
import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { selectAuthCredentials } from '@store/slices/authSlice';
import { selectIsReady } from '@store/slices/connectionSlice';
import { setRegisteredServicesLoading } from '@store/slices/serviceSlice';
import { getInternetMessageIdAsync, IsComposeMode } from '@hooks/useOfficeItem';
import { LeistungResponse } from '@components/interfaces/IService';
import { getWebRTCConnectionManager } from '../../../services/WebRTCConnectionManager';

interface RegisteredServiceProps {
  /** Refresh trigger – increment to force a reload */
  refreshTrigger?: any;
}

const RegisteredService: React.FC<RegisteredServiceProps> = ({ refreshTrigger }) => {
  const dispatch = useAppDispatch();
  const [leistungen, setLeistungen] = useState<LeistungResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const credentials = useAppSelector(selectAuthCredentials);
  const isReady = useAppSelector(selectIsReady);
  const { selectedAkt } = useAppSelector(state => state.akten);
  const loading = useAppSelector(state => state.service.registeredServicesLoading);

  // Get formatted time string from sachbearbeiter array
  const getTimeDisplay = (rowData: LeistungResponse): string => {
    if (!rowData.sachbearbeiter || rowData.sachbearbeiter.length === 0) return '';
    return rowData.sachbearbeiter[0]?.zeitVerrechenbar || '';
  };

  // Get SB kürzel from sachbearbeiter array
  const getSbDisplay = (rowData: LeistungResponse): string => {
    if (!rowData.sachbearbeiter || rowData.sachbearbeiter.length === 0) return '';
    return rowData.sachbearbeiter
      .map(sb => sb.sachbearbeiter || sb.fürSachbearbeiter)
      .filter(Boolean)
      .join(', ');
  };

  useEffect(() => {
    if (!isReady || !selectedAkt) {
      setLeistungen([]);
      return;
    }

    (async () => {
      dispatch(setRegisteredServicesLoading(true));
      setError(null);
      try {
        const erstelltAb = new Date();
        erstelltAb.setDate(erstelltAb.getDate() - 7);

        const connectionManager = getWebRTCConnectionManager();
        const webRTCApiService = connectionManager.getWebRTCApiService();

        const isCompose = IsComposeMode();
        let outlookEmailId: string | null = null;

        if (!isCompose) {
          try {
            const email = Office.context.mailbox.item;
            outlookEmailId = await getInternetMessageIdAsync(email);
          } catch {
            // Proceed without outlookEmailId
          }
        }

        const response = await webRTCApiService.getLeistungenByAkt({
          aktId: selectedAkt?.id ?? null,
          // outlookEmailId,
          erstelltAb,
          erstelltVon: credentials?.username,
        });

        if (response.statusCode === 200) {
          const data = JSON.parse(response.body || '[]') as LeistungResponse[];
          setLeistungen(data);
        } else if (response.statusCode === 404) {
          setError('No registered services found.');
        } else {
          setError('Failed to load registered services.');
        }
      } catch (err) {
        setError('Error fetching registered services.');
        console.error('RegisteredService fetch error:', err);
      } finally {
        dispatch(setRegisteredServicesLoading(false));
      }
    })();
  }, [refreshTrigger, selectedAkt?.id]);

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ alignItems: 'baseline', gap: 8 }}>
        Registered Services (last 7 days)
      </h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <DataGrid
        dataSource={leistungen}
        keyExpr="id"
        showBorders={false}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText={loading ? 'Loading...' : !selectedAkt ? 'Select a case to view registered services' : 'No services found'}
        height={250}
      >
        <Paging defaultPageSize={7} />
        <Pager visible showPageSizeSelector={false} allowedPageSizes={[7]} showInfo />
        <Column
          dataField="leistungKurz"
          caption="Kürzel"
          alignment="left"
        />
        <Column
          dataField="datum"
          caption="Date"
          dataType="date"
          format="yyyy-MM-dd"
          alignment="left"
        />
        <Column
          dataField="honorartext"
          caption="Text"
          alignment="left"
        />
        <Column
          caption="Time"
          alignment="left"
          calculateCellValue={getTimeDisplay}
        />
        <Column
          caption="SB"
          alignment="left"
          calculateCellValue={getSbDisplay}
        />
      </DataGrid>
    </div>
  );
};

export default RegisteredService;
