
import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { selectAuthCredentials } from '@store/slices/authSlice';
import { selectIsReady } from '@store/slices/connectionSlice';
import { setRegisteredServicesLoading } from '@store/slices/serviceSlice';
import { getInternetMessageIdAsync, IsComposeMode } from '@hooks/useOfficeItem';
import { LeistungResponse } from '@components/interfaces/IService';
import { getWebRTCConnectionManager } from '../../../services/WebRTCConnectionManager';
import { useTranslation } from 'react-i18next';

interface RegisteredServiceProps {
  /** Refresh trigger – increment to force a reload */
  refreshTrigger?: any;
}

const RegisteredService: React.FC<RegisteredServiceProps> = ({ refreshTrigger }) => {
  const dispatch = useAppDispatch();
  const [leistungen, setLeistungen] = useState<LeistungResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { t: translate } = useTranslation('service');

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
          setError(translate('noRegisteredServices'));
        } else {
          setError(translate('failedToLoadServices'));
        }
      } catch (err) {
        setError(translate('errorFetchingServices'));
        console.error('RegisteredService fetch error:', err);
      } finally {
        dispatch(setRegisteredServicesLoading(false));
      }
    })();
  }, [refreshTrigger, selectedAkt?.id]);

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ alignItems: 'baseline', gap: 8 }}>
        {translate('registeredServices')}
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
        noDataText={loading ? translate('loading', { ns: 'common' }) : !selectedAkt ? translate('selectCaseToViewServices') : translate('noServicesFound')}
        height={250}
      >
        <Paging defaultPageSize={7} />
        <Pager visible showPageSizeSelector={false} allowedPageSizes={[7]} showInfo />
        <Column
          dataField="leistungKurz"
          caption={translate('columns.kuerzel')}
          alignment="left"
        />
        <Column
          dataField="datum"
          caption={translate('columns.date')}
          dataType="date"
          format="yyyy-MM-dd"
          alignment="left"
        />
        <Column
          dataField="honorartext"
          caption={translate('columns.text')}
          alignment="left"
        />
        <Column
          caption={translate('columns.time')}
          alignment="left"
          calculateCellValue={getTimeDisplay}
        />
        <Column
          caption={translate('columns.sb')}
          alignment="left"
          calculateCellValue={getSbDisplay}
        />
      </DataGrid>
    </div>
  );
};

export default RegisteredService;
