// src/taskpane/components/tabs/cases/CasesAccordion.tsx
import React, { useState, useEffect, useCallback } from 'react';
import 'devextreme/dist/css/dx.light.css';
import './CaseTabContent.css'; // Import our custom CSS
import SearchCaseList from './SearchCaseList';
import {IsComposeMode} from '../../../hooks/useOfficeItem';
import {HierarchyTree} from '../../interfaces/ICase';
import { DokumentResponse } from '../../interfaces/IDocument';
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus';
import notify from 'devextreme/ui/notify';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { createSelector } from '@reduxjs/toolkit';
import { 
  getFavoriteAktenAsync, 
  getCaseDocumentsAsync, 
  removeAktFromFavoriteAsync,
  downloadDocumentAsync
} from '../../../../store/slices/aktenSlice';
import TreeList, {
  Column,
  Scrolling,
  Editing,
} from 'devextreme-react/tree-list';
import { 
  getMimeTypeFromExtension, 
  getFileExtension, 
  createBlobFromBase64, 
  isViewableInBrowser 
} from '../../../utils/fileHelpers';
import { getLogger } from '../../../../services/logger';

const logger = getLogger();

const allowDeleting = (e) => e.row.data.ID !== 1; 

const CaseTabContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { 
    favouriteAkten,
    loading, 
    favoritesLoading,
    caseDocumentsLoading, 
    loadingCaseDocumentsForAktId,
    removeFromFavoriteLoading,
    removingFromFavoriteAktId
  } = useAppSelector(state => state.akten);
  
  const [nodes, setNodes] = useState<HierarchyTree[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<(string | number)[]>([]);
  // Store documents in component state (keyed by aktId)
  const [dokumentsByAkt, setDokumentsByAkt] = useState<Map<number, DokumentResponse[]>>(new Map());
  // Track which document is currently being opened/downloaded
  const [openingDocumentId, setOpeningDocumentId] = useState<number | null>(null);

  // Load favorite Akten on mount (thunk handles cache)
  useEffect(() => {    
    if (!favoritesLoading && favouriteAkten.length === 0) {
      dispatch(getFavoriteAktenAsync({ 
        NurFavoriten: true,
        Count: 50
      }));
    }
  }, [dispatch]); // Run once on mount

  // Transform favorite Akten and loaded documents into HierarchyTree format with folder structure
  useEffect(() => {
    const transformedNodes: HierarchyTree[] = [];
    // Add favorite Akten as root nodes (AktenResponse format: Id, AKurz, Causa)
    favouriteAkten.forEach((akt) => {
      const aktNode: HierarchyTree = {
        id: akt.id, // Use actual Akt ID as node ID
        rootId: -1, // Top-level nodes have rootId = -1
        name: `${akt.aKurz || 'Unknown'}`,
        isStructure: true, // This is a folder (Akt)
        hasChild: true,
        causa: akt.causa || '',
        hasUrl: false,
        url: `akt:${akt.id}`, // Store Akt ID in URL for identification
      };
      transformedNodes.push(aktNode);
    });

    // Process documents and create folder structure
    const folderMap = new Map<string, HierarchyTree>();
    let nextId = Math.max(...favouriteAkten.map(a => a.id), 0) + 10000; // Start IDs after Akt IDs

    // Get all documents from component state
    const allDocs: DokumentResponse[] = [];
    dokumentsByAkt.forEach(docs => allDocs.push(...docs));
    
    allDocs.forEach((doc) => {
      // Find the parent Akt ID
      const parentAkt = favouriteAkten.find(akt => akt.id === doc.aktId);
      
      if (parentAkt && doc.dateipfad) {
        // Parse the Windows-style file path to create folder structure
        // Example: "C:\ADVOKAT\Daten\WINWORD\ADVOKAT\TEST-1\Email\email 31_07_2025 12_49.msg"
        // We want to extract just the relative folder structure after the case folder
        
        let relativePath = doc.dateipfad;
        
        // Try to find the case folder (aKurz) in the path to extract relative structure
        if (parentAkt.aKurz) {
          const caseIndex = relativePath.indexOf(parentAkt.aKurz);
          if (caseIndex !== -1) {
            // Extract everything after the case folder
            const afterCase = relativePath.substring(caseIndex + parentAkt.aKurz.length);
            if (afterCase.startsWith('\\') || afterCase.startsWith('/')) {
              relativePath = afterCase.substring(1); // Remove leading slash
            }
          }
        }
        
        // Split the path by backslashes or forward slashes
        const pathParts = relativePath.split(/[\\\/]/).filter(part => part.length > 0);
        const fileName = pathParts.pop() || doc.betreff || 'Unknown File';
        
        let currentParentId = parentAkt.id;
        
        // Create folder hierarchy only if there are folder parts
        if (pathParts.length > 0) {
          pathParts.forEach((folderName, index) => {
            const folderPath = pathParts.slice(0, index + 1).join('\\');
            const folderKey = `${parentAkt.id}:${folderPath}`;
            
            if (!folderMap.has(folderKey)) {
              const folderNode: HierarchyTree = {
                id: nextId++,
                rootId: currentParentId,
                name: folderName,
                isStructure: true, // This is a folder
                hasChild: true,
                causa: '',
                hasUrl: false,
                url: '', 
              };
              folderMap.set(folderKey, folderNode);
              transformedNodes.push(folderNode);
            }
            
            currentParentId = folderMap.get(folderKey)!.id;
          });
        }

        // Add the actual file
        const fileNode: HierarchyTree = {
          id: nextId++,
          rootId: currentParentId, // Parent is the deepest folder or the Akt itself
          name: fileName,
          isStructure: false, // This is a file
          hasChild: false,
          causa: doc.betreff || '', // Show document subject as causa
          hasUrl: !!doc.dateipfad,
          url: doc.dateipfad || '',
          documentId: doc.id, // Store the actual document ID for downloads
        };
        transformedNodes.push(fileNode);
      }
    });

    setNodes(transformedNodes);
  }, [favouriteAkten, dokumentsByAkt]);

  const onSelectionChanged = useCallback((e) => {
    // keep expandedKeys in sync
    setExpandedKeys(e.component.getSelectedRowKeys());
  }, []);

  // Handle expanding nodes to load documents (cache handled by thunk)
  const onExpandedRowKeysChange = useCallback(async (newExpandedKeys: (string | number)[]) => {
    const previousExpandedKeys = expandedKeys;
    setExpandedKeys(newExpandedKeys);
    
    // Find newly expanded keys (keys that were added)
    const newlyExpanded = newExpandedKeys.filter(key => !previousExpandedKeys.includes(key));
    
    // Only process newly expanded Akten (not collapsed ones or re-expanded folders)
    for (const key of newlyExpanded) {
      const node = nodes.find(n => n.id === key);
      
      // Check if this is an Akt node (root level with akt: URL)
      if (node && 
          node.isStructure && 
          node.url.startsWith('akt:') && 
          node.rootId === -1) { // Ensure it's a root level Akt
        
        const aktId = parseInt(node.url.replace('akt:', ''));
        
        // Check if documents are already loaded in component state
        const hasLoadedDocuments = dokumentsByAkt.has(aktId);
        
        // Only load documents if not already loaded and not currently loading
        if (!hasLoadedDocuments && 
            loadingCaseDocumentsForAktId !== aktId && 
            !caseDocumentsLoading) {
          logger.debug(`Loading documents for Akt ${aktId}`, 'CaseTabContent');
          try {
            const result = await dispatch(getCaseDocumentsAsync({ aktId, Count: 100 })).unwrap();
            // Store documents in component state
            setDokumentsByAkt(prev => new Map(prev).set(aktId, result.documents));
          } catch (error) {
            logger.error(`Failed to load documents for Akt ${aktId}:`, 'CaseTabContent', error);
          }
        } else if (hasLoadedDocuments) {
          logger.debug(`Documents for Akt ${aktId} already loaded`, 'CaseTabContent');
        }
      }
    }
  }, [nodes, expandedKeys, caseDocumentsLoading, loadingCaseDocumentsForAktId, dokumentsByAkt, dispatch]);


  const handleOpen = useCallback(async (node: HierarchyTree) => {
    if (node.isStructure && node.url.startsWith('akt:')) {
      // This is an Akt node, load its documents (handled by expand event)
      const currentExpanded = [...expandedKeys];
      if (!currentExpanded.includes(node.id)) {
        currentExpanded.push(node.id);
        onExpandedRowKeysChange(currentExpanded);
      }
    } else if (!node.isStructure && node.documentId) {
      // This is a document, download and open the file
      setOpeningDocumentId(node.documentId);
      let downloadingToast: any = null;
      try {
        logger.debug(`Downloading document with ID: ${node.documentId}`, 'CaseTabContent');
        
        // Show persistent notification during download
        try {
          downloadingToast = notify(`Downloading ${node.name}...`, 'info', 0); // 0 means persistent
        } catch {
          // Fallback if the above doesn't work
          downloadingToast = null;
        }
        
        // Get document content via WebRTC (returns base64 string directly)
        const fileContentBase64 = await dispatch(downloadDocumentAsync(node.documentId)).unwrap();
        
        // Hide the downloading notification once we have the data
        if (downloadingToast && typeof downloadingToast.hide === 'function') {
          downloadingToast.hide();
        }
        
        if (!fileContentBase64) {
          notify('Document content is empty', 'warning', 3000);
          return;
        }

        // Use node name as filename and detect MIME type from file extension
        const fileName = node.name;
        const extension = getFileExtension(fileName);
        const mimeType = getMimeTypeFromExtension(extension);

        // Create blob and URL for download/viewing
        const blob = createBlobFromBase64(fileContentBase64, mimeType);
        const url = URL.createObjectURL(blob);
        
        // Determine if file can be opened in browser
        const canViewInBrowser = isViewableInBrowser(mimeType);
        
        if (canViewInBrowser) {
          // Automatically open viewable files in new window/tab
          try {
            const newWindow = window.open(url, '_blank');
            if (newWindow) {
              notify(`Opened ${fileName} in new tab`, 'success', 3000);
              
              // Clean up the URL after a delay to allow the new window to load
              setTimeout(() => {
                URL.revokeObjectURL(url);
              }, 1000);
            } else {
              throw new Error('Popup blocked or window.open failed');
            }
          } catch (error) {
            // Fallback to download if opening fails
            logger.debug('Failed to open in new window, falling back to download', 'CaseTabContent', error);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notify(`Downloaded ${fileName} (could not open in browser)`, 'success', 3000);
          }
        } else {
          // Download non-viewable files (like .msg, .docx, etc.)
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          notify(`Downloaded ${fileName}`, 'success', 3000);
        }
      } catch (error) {
        // Hide the downloading notification in case of error
        if (downloadingToast && typeof downloadingToast.hide === 'function') {
          downloadingToast.hide();
        }
        logger.error('Failed to download document:', 'CaseTabContent', error);
        notify(`Failed to download ${node.name}: ${error}`, 'error', 5000);
      } finally {
        setOpeningDocumentId(null);
      }
    } else {
      // Fallback for nodes without documentId (shouldn't happen for documents)
      logger.warn('Document node missing documentId', 'CaseTabContent', node);
      notify('Unable to download: Document ID missing', 'warning', 3000);
    }
  }, [expandedKeys, onExpandedRowKeysChange]);

  const handleAdd = useCallback(async (node: HierarchyTree) => {
    if (node.isStructure) return; // Can't add Akt folders as attachments
    
    // For documents, we need to get the file content via WebRTC
    let attachingToast: any = null;
    try {
      if (!node.documentId) {
        notify('Unable to attach: Document ID missing', 'warning', 3000);
        return;
      }

      // Show persistent notification during attachment process
      try {
        attachingToast = notify(`Adding ${node.name} as attachment...`, 'info', 0); // 0 means persistent
      } catch {
        attachingToast = null;
      }
      
      // Get document content via WebRTC (returns base64 string directly)
      const fileContentBase64 = await dispatch(downloadDocumentAsync(node.documentId)).unwrap();
      
      if (!fileContentBase64) {
        if (attachingToast && typeof attachingToast.hide === 'function') {
          attachingToast.hide();
        }
        notify('Document content is empty', 'warning', 3000);
        return;
      }

      // Use node name as filename
      const fileName = node.name;

      await new Promise<void>((resolve, reject) => {
        Office.context.mailbox.item.addFileAttachmentFromBase64Async(
          fileContentBase64, 
          fileName,
          { isInline: false },
          result => {
            // Hide the attaching notification
            if (attachingToast && typeof attachingToast.hide === 'function') {
              attachingToast.hide();
            }
            
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              notify(`Attached ${fileName} to email`, 'success', 3000);
              resolve();
            } else { 
              logger.error('Failed to attach file to email', 'CaseTabContent', result);
              reject(result.error);
            }
          }
        );
      });
    } catch (error) {
      // Hide the attaching notification in case of error
      if (attachingToast && typeof attachingToast.hide === 'function') {
        attachingToast.hide();
      }
      logger.error('Failed to add attachment:', 'CaseTabContent', error);
      notify(`Failed to attach ${node.name}: ${error}`, 'error', 5000);
    }
  }, []);

  const handleDelete = useCallback(async (node: any) => {
    try {
      // Extract the Akt ID from the node (for top-level Akten, use the node id directly)
      const aktId = node.id;
      const aktName = node.name || `Akt ID ${aktId}`;
      // Use the new WebRTC Redux approach
      await dispatch(removeAktFromFavoriteAsync(aktId)).unwrap();
      notify(`Successfully removed "${aktName}" from favorites!`, 'success', 3000);
      // Refresh favorite Akten to remove the deleted case from the list
      dispatch(getFavoriteAktenAsync({ 
        NurFavoriten: true,
        Count: 50
      }));
    } catch (error) {
      logger.error('Failed to remove from favorites:', 'CaseTabContent', error);
      notify(`Failed to remove from favorites: ${error}`, 'error', 5000);
    }
  }, [dispatch]);

   return (
    <div /* … */ style={{ position: 'relative', overflow: 'hidden' }}>
      {/* WebRTC Connection Status */}
      <WebRTCConnectionStatus />
      
      {/* … SearchCaseList, header, LoadPanel … */}

      <SearchCaseList />

      <div className="case-tab-treelist-container">
        <TreeList
          dataSource={nodes}
          keyExpr="id"
          parentIdExpr="rootId"
          rootValue={-1}           // top‐level nodes have rootId = -1
          expandedRowKeys={expandedKeys}
          onExpandedRowKeysChange={onExpandedRowKeysChange}
          onSelectionChanged={onSelectionChanged}
          hasItemsExpr="hasChild"
          showRowLines={false}
          showBorders={false}
          columnAutoWidth={false}  // Disable auto width to control column sizes manually
          allowColumnResizing={true}  // Allow user to resize columns if needed
          wordWrapEnabled={true}
          rowAlternationEnabled={true}  // Better visual separation for rows
          height={400}
          noDataText="No documents found. Expand a case to load documents."
        >
        <Scrolling mode="standard" />  {/* Enable horizontal scrolling as fallback */}
        
        {/* … Paging, Scrolling … */}
      <Editing
        allowUpdating={false}
        allowDeleting={false}
        allowAdding={false}
        mode="row" />
        {/* ── Main column: full folder/file tree (FIRST = gets expand arrows) ── */}
        <Column
          dataField="name"
          caption="Name"
          allowResizing={true}
          cellRender={({ data }: { data: HierarchyTree }) => {
            const isOpening = openingDocumentId !== null && openingDocumentId === data.documentId;
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: '2px 0',
                  lineHeight: '1.4',
                  flexWrap: 'wrap',
                }}
                title={data.name}
              >
                {/* Open icon — files only */}
                {!data.isStructure && (
                  <button
                    className={`dx-button dx-button-normal dx-button-mode-contained${isOpening ? ' loading-button' : ''}`}
                    onClick={(e) => { e.stopPropagation(); if (!isOpening) handleOpen(data); }}
                    disabled={isOpening}
                    title={isOpening ? 'Opening...' : 'Open file'}
                    style={{
                      flexShrink: 0,
                      border: 'none',
                      borderRadius: '3px',
                      padding: '2px 5px',
                      cursor: isOpening ? 'not-allowed' : 'pointer',
                      color: isOpening ? '#666' : '#1976d2',
                    }}
                  >
                    <i className={`dx-icon dx-icon-${isOpening ? 'refresh' : 'export'}`} style={{ fontSize: 13, color: isOpening ? '#666' : '#1976d2' }} />
                  </button>
                )}
                {/* Add-as-attachment icon — compose mode + files only */}
                {!data.isStructure && IsComposeMode() && (
                  <button
                    className="dx-button dx-button-normal dx-button-mode-contained"
                    onClick={(e) => { e.stopPropagation(); handleAdd(data); }}
                    title="Add as attachment"
                    style={{
                      flexShrink: 0,
                      border: 'none',
                      borderRadius: '3px',
                      padding: '2px 5px',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="dx-icon dx-icon-add" style={{ fontSize: 13 }} />
                  </button>
                )}

                {/* Folder / file icon */}
                {data.isStructure && data.url.startsWith('akt:') &&
                 caseDocumentsLoading && loadingCaseDocumentsForAktId === parseInt(data.url.replace('akt:', '')) ? (
                  <i className="dx-icon dx-icon-refresh" style={{ flexShrink: 0, fontSize: 14, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <i
                    className={data.isStructure ? 'dx-icon dx-icon-folder' : 'dx-icon dx-icon-file'}
                    style={{ flexShrink: 0, fontSize: 14 }}
                  />
                )}

                {/* Name */}
                <span style={{
                  wordBreak: 'break-word',
                  whiteSpace: 'normal',
                  flex: 1,
                  minWidth: 0,
                  opacity: data.isStructure && data.url.startsWith('akt:') &&
                           caseDocumentsLoading && loadingCaseDocumentsForAktId === parseInt(data.url.replace('akt:', '')) ? 0.7 : 1,
                }}>
                  {data.name}
                  {data.isStructure && data.url.startsWith('akt:') &&
                   caseDocumentsLoading && loadingCaseDocumentsForAktId === parseInt(data.url.replace('akt:', '')) && ' (Loading...)'}
                </span>
              </div>
            );
          }}
        />

        {/* ── Right column: delete icon for root Akt nodes only ────── */}
        <Column
          width={40}
          minWidth={40}
          allowResizing={false}
          fixed={true}
          fixedPosition="right"
          caption=""
          cellRender={({ data }: { data: HierarchyTree }) => {
            if (data.rootId !== -1) return null;
            const isDeleting = removeFromFavoriteLoading && removingFromFavoriteAktId === data.id;
            return (
              <button
                className={`dx-button dx-button-normal dx-button-mode-contained delete-favorite-btn${isDeleting ? ' loading-button' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleDelete(data); }}
                disabled={isDeleting}
                title={isDeleting ? 'Removing from favorites...' : 'Remove from favorites'}
                style={{
                  backgroundColor: isDeleting ? '#f5f5f5' : '#d32f2f',
                  color: isDeleting ? '#666' : 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 5px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                <i className={`dx-icon dx-icon-${isDeleting ? 'refresh' : 'trash'}`} style={{ fontSize: 13 }} />
              </button>
            );
          }}
        />


      </TreeList>
      </div>
    </div>
  );
};
export default CaseTabContent;
