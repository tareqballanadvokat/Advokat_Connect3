// src/taskpane/components/tabs/email/RegisteredEmails.tsx
import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, Pager } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { DokumentArt, DokumentResponse } from '../../interfaces/IDocument';
import { getWebRTCConnectionManager } from '../../../services/WebRTCConnectionManager';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import { selectAuthCredentials } from '../../../../store/slices/authSlice';
import { selectIsReady } from '../../../../store/slices/connectionSlice';
import { downloadDocumentAsync } from '../../../../store/slices/aktenSlice';
import {
  getMimeTypeFromExtension,
  getFileExtension,
  createBlobFromBase64,
  isViewableInBrowser,
} from '../../../utils/fileHelpers';


const RegisteredEmails: React.FC = () => {
  const dispatch = useAppDispatch();
  const [emails, setEmails] = useState<DokumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credentials = useAppSelector(selectAuthCredentials);
  const isReady = useAppSelector(selectIsReady);
  const saveCount = useAppSelector(state => state.email.saveCount);

  useEffect(() => {
    if (!isReady) return;
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
          // Sort descending by date (most recent first)
          data.sort((a, b) => {
            const da = a.datum ? new Date(a.datum).getTime() : 0;
            const db = b.datum ? new Date(b.datum).getTime() : 0;
            return db - da;
          });
          setEmails(data);
        } else if (response.statusCode === 404) {
          setError('No registered e-mails found.');
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
  }, [isReady, saveCount]);

  const handleOpen = async (doc: DokumentResponse) => {
    try {
      notify(`Opening ${doc.betreff ?? 'email'}...`, 'info', 2000);
      const base64 = await dispatch(downloadDocumentAsync(doc.id)).unwrap();
      if (!base64) { notify('Empty content', 'warning', 3000); return; }

      // Resolve a filename with extension:
      // 1. Use doc.fileName if available
      // 2. Extract the filename from the server-side dateipfad (e.g. "C:\...\file.eml")
      // 3. Fall back to subject + .eml for emails
      let fileName = doc.fileName ?? '';
      if (!getFileExtension(fileName) && doc.dateipfad) {
        const parts = doc.dateipfad.replace(/\\/g, '/').split('/');
        const last = parts[parts.length - 1];
        if (last && getFileExtension(last)) fileName = last;
      }
      if (!getFileExtension(fileName)) {
        const isEmail = doc.dokumentArt === DokumentArt.MailEmpfangen ||
                        doc.dokumentArt === DokumentArt.MailGesendet ||
                        doc.dokumentArt === 'MailEmpfangen' ||
                        doc.dokumentArt === 'MailGesendet';
        fileName = `${doc.betreff ?? `email_${doc.id}`}${isEmail ? '.eml' : ''}`;
      }
      const mimeType = getMimeTypeFromExtension(getFileExtension(fileName));
      const blob = createBlobFromBase64(base64, mimeType);
      const url = URL.createObjectURL(blob);
      DownloadFile(url, fileName);
    } catch (err) {
      const msg = err.message.includes('404')
        ? 'Document not found. It may have been deleted.'
        : 'Failed to open email.';
      notify(msg, 'error', 3000);
      console.error('RegisteredEmails open error:', err);
    }
  };

  const DownloadFile = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const typeCell = (data: { data: DokumentResponse }) => {
    const art = data.data.dokumentArt;
    const isSent = art === DokumentArt.MailGesendet || art === 'MailGesendet';
    return <span>{isSent ? 'Sent' : 'Received'}</span>;
  };

  const openCell = (data: { data: DokumentResponse }) => (
    <button
      onClick={() => handleOpen(data.data)}
      style={{
        background: 'none', border: 'none', color: '#0078d4',
        cursor: 'pointer', fontSize: '12px', padding: 0,
      }}
    >
      Open
    </button>
  );

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
        <Pager visible showPageSizeSelector={false} allowedPageSizes={[7]} showInfo />
        <Column caption="Type" cellRender={typeCell} width={80} alignment="left" />
        <Column caption="" cellRender={openCell} width={50} alignment="center" />
        <Column dataField="betreff" caption="Subject" alignment="left" />
      </DataGrid>
    </div>
  );
};

export default RegisteredEmails;
