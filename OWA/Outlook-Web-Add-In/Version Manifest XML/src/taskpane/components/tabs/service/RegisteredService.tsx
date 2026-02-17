
import React, { useEffect } from 'react';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { loadLeistungenAsync } from '@store/slices/serviceSlice';
import { getInternetMessageIdAsync, IsComposeMode } from '@hooks/useOfficeItem';

interface RegisteredServiceProps {
  /** Refresh trigger */
  refreshTrigger?: any;
}

const RegisteredService: React.FC<RegisteredServiceProps> = ({ refreshTrigger }) => {
  const dispatch = useAppDispatch();
  
  // Get the selected Akt and saved Leistungen from Redux state
  const { selectedAkt } = useAppSelector(state => state.akten);
  const { savedLeistungen, savedLeistungenLoading, savedLeistungenError } = useAppSelector(state => state.service);

  useEffect(() => {
    // Load Leistungen when the Akt changes or refresh is triggered
    const loadLeistungen = async () => {
      if (selectedAkt?.id) {
        const isCompose = IsComposeMode();
        
        if (isCompose) {
          // Compose mode: only use aktId
          console.log('📧 Compose mode - loading Leistungen by aktId only');
          dispatch(loadLeistungenAsync({ 
            aktId: selectedAkt.id,
            count: 10 
          }));
        } else {
          // Read mode: use outlookEmailId
          try {
            const email = Office.context.mailbox.item;
            const outlookEmailId = await getInternetMessageIdAsync(email);
            console.log('📧 Read mode - loading Leistungen by email ID:', outlookEmailId);
            
            dispatch(loadLeistungenAsync({ 
              outlookEmailId: outlookEmailId,
              count: 10 
            }));
          } catch (error) {
            console.warn('⚠️ Could not get email ID, loading by aktId instead:', error);
            dispatch(loadLeistungenAsync({ 
              aktId: selectedAkt.id,
              count: 10 
            }));
          }
        }
      }
    };
    
    loadLeistungen();
  }, [selectedAkt, refreshTrigger, dispatch]);

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ alignItems: 'baseline', gap: 8 }}>
        Registered Services (last 10 entries) 
      </h3>

      <DataGrid
        dataSource={savedLeistungen}
        keyExpr="id"
        showBorders={false}
        showColumnLines={false}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={false}
        noDataText={savedLeistungenLoading ? "Loading..." : savedLeistungenError || "No service found"}
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
          dataField="bearbeitungsInfoErstelltVon"
          caption="SB"
          alignment="left"
        />
      </DataGrid>
    </div>
  );
};

export default RegisteredService;
