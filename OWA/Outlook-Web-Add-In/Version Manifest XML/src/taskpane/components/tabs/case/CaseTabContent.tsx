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
  selectCachedDocumentsForAkt,
  selectHasCachedDocumentsForAkt
} from '../../../../store/slices/aktenSlice';
import TreeList, {
  Column,
  Scrolling,
  Editing,
  Button,
} from 'devextreme-react/tree-list';

import { getFileContent } from '../../../utils/api'; // your API
import { webRTCApiService } from '../../../services/webRTCApiService';

const allowDeleting = (e) => e.row.data.ID !== 1; 

// Memoized selector for all cached documents to prevent unnecessary rerenders
const selectAllCachedDocuments = createSelector(
  [(state) => state.akten.caseDocumentsCache],
  (caseDocumentsCache) => {
    const allDocs: DokumentResponse[] = [];
    caseDocumentsCache.forEach(cache => {
      allDocs.push(...cache.documents);
    });
    return allDocs;
  }
);

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

  // Load favorite Akten only once when component mounts and no data exists
  useEffect(() => {    
    if (favouriteAkten.length === 0 && !favoritesLoading) {
      dispatch(getFavoriteAktenAsync({ 
        NurFavoriten: true,
        Count: 50
      }));
    }
  }, [dispatch, favouriteAkten.length, favoritesLoading]); // Keep favouriteAkten.length as dependency to detect when it becomes empty

  // Get all cached documents for display using memoized selector
  const allCachedDocuments = useAppSelector(selectAllCachedDocuments);

  // Transform favorite Akten and cached documents into HierarchyTree format with folder structure
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

    // Use all cached documents
    allCachedDocuments.forEach((doc) => {
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
  }, [favouriteAkten, allCachedDocuments]);

  const onSelectionChanged = useCallback((e) => {
    // keep expandedKeys in sync
    setExpandedKeys(e.component.getSelectedRowKeys());
  }, []);

  // Get cache state for checking
  const caseDocumentsCache = useAppSelector(state => state.akten.caseDocumentsCache);

  // Handle expanding nodes to load documents with caching
  const onExpandedRowKeysChange = useCallback((newExpandedKeys: (string | number)[]) => {
    const previousExpandedKeys = expandedKeys;
    setExpandedKeys(newExpandedKeys);
    
    // Find newly expanded keys (keys that were added)
    const newlyExpanded = newExpandedKeys.filter(key => !previousExpandedKeys.includes(key));
    
    // Only process newly expanded Akten (not collapsed ones or re-expanded folders)
    newlyExpanded.forEach((key) => {
      const node = nodes.find(n => n.id === key);
      
      // Check if this is an Akt node (root level with akt: URL)
      if (node && 
          node.isStructure && 
          node.url.startsWith('akt:') && 
          node.rootId === -1) { // Ensure it's a root level Akt
        
        const aktId = parseInt(node.url.replace('akt:', ''));
        
        // Check if documents are already cached for this Akt
        const hasCachedDocuments = caseDocumentsCache.some(cache => cache.aktId === aktId);
        
        // Only load documents if:
        // 1. They're not already cached
        // 2. We're not currently loading for this specific Akt
        // 3. We're not already loading something else
        if (!hasCachedDocuments && 
            loadingCaseDocumentsForAktId !== aktId && 
            !caseDocumentsLoading) {
          console.log(`📄 Loading documents for Akt ${aktId} (not cached)`);
          dispatch(getCaseDocumentsAsync({ aktId, Count: 100 }));
        } else if (hasCachedDocuments) {
          console.log(`📄 Documents for Akt ${aktId} already cached, skipping API call`);
        }
      }
    });
  }, [nodes, expandedKeys, caseDocumentsLoading, loadingCaseDocumentsForAktId, caseDocumentsCache, dispatch]);


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
      let downloadingToast: any = null;
      try {
        console.log(`Downloading document with ID: ${node.documentId}`);
        
        // Show persistent notification during download
        try {
          downloadingToast = notify(`Downloading ${node.name}...`, 'info', 0); // 0 means persistent
        } catch {
          // Fallback if the above doesn't work
          downloadingToast = null;
        }
        
        // Check if WebRTC connection is ready
        if (!webRTCApiService.isReady()) {
          if (downloadingToast && typeof downloadingToast.hide === 'function') {
            downloadingToast.hide();
          }
          notify('WebRTC connection not available. Please ensure connection is established.', 'warning', 5000);
          return;
        }

        // Get document with content via WebRTC
        const documentData = await webRTCApiService.getDocumentWithContent(node.documentId);
        
        // Hide the downloading notification once we have the data
        if (downloadingToast && typeof downloadingToast.hide === 'function') {
          downloadingToast.hide();
        }
        
        if (!documentData.inhalt) {
          // Hide the downloading notification
          if (downloadingToast && typeof downloadingToast.hide === 'function') {
            downloadingToast.hide();
          }
          notify('Document content is empty', 'warning', 3000);
          return;
        }

        // Convert base64 to binary data
        const binaryString = atob(documentData.inhalt);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Use the content type and filename from the API response, with fallbacks
        const mimeType = documentData.contentType || 'application/octet-stream';
        const fileName = documentData.fileName || node.name;

        // Create blob and open/download based on file type
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Determine if file can be opened in browser
        const viewableTypes = [
          'application/pdf',
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
          'text/plain', 'text/html', 'text/css', 'text/javascript',
          'application/json', 'application/xml'
        ];
        
        const canViewInBrowser = viewableTypes.includes(mimeType) || mimeType.startsWith('text/') || mimeType.startsWith('image/');
        
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
            console.log('Failed to open in new window, falling back to download:', error);
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
        console.error('Failed to download document:', error);
        notify(`Failed to download ${node.name}: ${error}`, 'error', 5000);
      }
    } else {
      // Fallback for nodes without documentId (shouldn't happen for documents)
      console.warn('Document node missing documentId:', node);
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
      
      // Check if WebRTC connection is ready
      if (!webRTCApiService.isReady()) {
        if (attachingToast && typeof attachingToast.hide === 'function') {
          attachingToast.hide();
        }
        notify('WebRTC connection not available. Please ensure connection is established.', 'warning', 5000);
        return;
      }

      // Get document content via WebRTC
      const documentData = await webRTCApiService.getDocumentWithContent(node.documentId);
      
      if (!documentData.inhalt) {
        if (attachingToast && typeof attachingToast.hide === 'function') {
          attachingToast.hide();
        }
        notify('Document content is empty', 'warning', 3000);
        return;
      }

      // Use filename from API response or fallback to node name
      const fileName = documentData.fileName || node.name;

      await new Promise<void>((resolve, reject) => {
        Office.context.mailbox.item.addFileAttachmentFromBase64Async(
          documentData.inhalt, 
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
              console.log(result);
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
      console.error('Failed to add attachment:', error);
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
      console.error('Failed to remove from favorites:', error);
      notify(`Failed to remove from favorites: ${error}`, 'error', 5000);
    }
  }, [dispatch]);

  // Handler to manually reload favorite Akten (force refresh from API)
  const handleLoadFavorites = useCallback(() => {
    dispatch(getFavoriteAktenAsync({ 
      NurFavoriten: true,
      Count: 50
    }));
  }, [dispatch]);

   return (
    <div /* … */ style={{ position: 'relative', overflow: 'hidden' }}>
      {/* WebRTC Connection Status */}
      <WebRTCConnectionStatus />
      
      {/* … SearchCaseList, header, LoadPanel … */}

      <SearchCaseList />

      {/* Load Favorites Button - only visible when favorites are already cached (subsequent visits) */}
      {favouriteAkten.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          margin: '10px 0',
          padding: '5px 0'
        }}>
          <button
            onClick={handleLoadFavorites}
            disabled={favoritesLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: favoritesLoading ? '#ccc' : '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: favoritesLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {favoritesLoading ? 'Loading...' : 'Reload Favorites'}
          </button>
        </div>
      )}

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
          wordWrapEnabled={false}  // Disable word wrapping to keep rows compact
          rowAlternationEnabled={true}  // Better visual separation for rows
          height={400}
          noDataText="No documents found. Expand a case to load documents."
        >
        <Scrolling mode="standard" />  {/* Enable horizontal scrolling as fallback */}
        
        {/* … Paging, Scrolling … */}
      <Editing
        allowUpdating={false}
        allowDeleting={allowDeleting}
        allowAdding={false}
        mode="row" />
        <Column
          dataField="name"
          caption="Name"
          width="50%"  // Share space between name and description
          minWidth={200}  // Minimum width to ensure readability
          allowResizing={true}  // Allow user to resize the name column
          cellRender={({ data }: { data: HierarchyTree }) => (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center',  // Center align for compact display
                gap: 6,
                padding: '2px 0',  // Minimal vertical padding
                lineHeight: '1.2',  // Compact line height
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'  // Keep text on single line
              }}
              title={data.name}  // Show full name on hover
            >
              {/* Show loading icon for Akt folders when documents are being loaded */}
              {data.isStructure && data.url.startsWith('akt:') && 
               caseDocumentsLoading && loadingCaseDocumentsForAktId === parseInt(data.url.replace('akt:', '')) ? (
                <i
                  className="dx-icon dx-icon-refresh"
                  style={{ 
                    flexShrink: 0,
                    fontSize: '14px',
                    animation: 'spin 1s linear infinite'
                  }}
                />
              ) : (
                <i
                  className={
                    data.isStructure
                      ? 'dx-icon dx-icon-folder'
                      : 'dx-icon dx-icon-file'
                  }
                  style={{ 
                    flexShrink: 0,  // Prevent icon from shrinking
                    fontSize: '14px'  // Smaller icon size
                  }}
                />
              )}
              <span style={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: data.isStructure && data.url.startsWith('akt:') && 
                         caseDocumentsLoading && loadingCaseDocumentsForAktId === parseInt(data.url.replace('akt:', '')) ? 0.7 : 1
              }}>
                {data.name}
                {data.isStructure && data.url.startsWith('akt:') && 
                 caseDocumentsLoading && loadingCaseDocumentsForAktId === parseInt(data.url.replace('akt:', '')) && ' (Loading...)'}
              </span>
            </div>
          )}
        />
        
        <Column
          dataField="causa"
          caption="Description"
          width="calc(50% - 140px)"  // Take remaining space minus fixed button column width
          minWidth={150}  // Minimum width to ensure readability
          allowResizing={true}
          visible={true}
          cellRender={({ data }: { data: HierarchyTree }) => (
            <span 
              style={{ 
                fontSize: '11px',
                color: '#666',
                fontStyle: data.isStructure ? 'italic' : 'normal',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: '1.2'
              }}
              title={data.causa}
            >
              {data.causa || (data.isStructure ? 'Folder' : 'Document')}
            </span>
          )}
        />
 
 
      <Column 
        type="buttons" 
        width={140}  // Fixed width for buttons column (enough for 3 buttons)
        minWidth={140}  // Minimum width to prevent shrinking
        allowResizing={true}  // Prevent user from resizing this column
        fixed={true}  // Keep buttons column fixed/visible
        fixedPosition="right"  // Fix to the right side
      > 
        {/* Open/View button - for documents */}
        <Button 
          text="open"
          hint="Open file"
          onClick={({ row }) => handleOpen(row.data)}
          visible={({ row }) => !row.data.isStructure}
        />

        {/* Add attachment button - for documents in compose mode */}
        <Button 
          icon="add"
          hint="Add as attachment"
          onClick={({ row }) => handleAdd(row.data)}
          visible={({ row }) => IsComposeMode() && !row.data.isStructure}
        />
        
        {/* Delete favorite button - only for top-level Akten */}
        <Button
          render={({ data }) => {
            const aktId = data.id;
            const isLoading = removeFromFavoriteLoading && removingFromFavoriteAktId === aktId;
            return (
              <button
                className={`dx-button dx-button-normal dx-button-mode-contained ${isLoading ? 'loading-button' : ''}`}
                onClick={() => handleDelete(data)}
                disabled={isLoading}
                title={isLoading ? 'Removing from favorites...' : 'Remove from favorites'}
                style={{
                  backgroundColor: isLoading ? '#f5f5f5' : '#d32f2f',
                  color: isLoading ? '#666' : 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                <i className={`dx-icon dx-icon-${isLoading ? 'refresh' : 'trash'}`} />
              </button>
            );
          }}
          visible={({ row }) => row.data.rootId === -1}
        />
      </Column>
      </TreeList>
      </div>
    </div>
  );
};
export default CaseTabContent;
