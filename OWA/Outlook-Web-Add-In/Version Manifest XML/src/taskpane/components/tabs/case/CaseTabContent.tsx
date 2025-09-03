// src/taskpane/components/tabs/cases/CasesAccordion.tsx
import React, { useState, useEffect, useCallback } from 'react';
import 'devextreme/dist/css/dx.light.css';
import './CaseTabContent.css'; // Import our custom CSS
import SearchCaseList from './SearchCaseList';
import {IsComposeMode, setAttachmentToItemAsync} from '../../../hooks/useOfficeItem'
import LoadPanel from 'devextreme-react/load-panel';
import {HierarchyTree} from '../../interfaces/ICase'
import WebRTCConnectionStatus from '../shared/WebRTCConnectionStatus';
import notify from 'devextreme/ui/notify';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { getFavoriteAktenAsync, getAktDokumenteAsync, clearDocuments, removeAktFromFavoriteAsync } from '../../../../store/slices/aktenSlice';
import TreeList, {
  Column,
  Scrolling,
  FilterRow,
  HeaderFilter,Editing,
  Paging,Button, type TreeListTypes,
  Pager,
  // Command column for buttons
 
} from 'devextreme-react/tree-list';

import { getFileContent } from '../../../utils/api'; // your API



const allowDeleting = (e) => e.row.data.ID !== 1;
function allowDeletingVisible()
{
  return false;
} 


const CaseTabContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { favouriteAkten, selectedAktDocuments, loading, documentsLoading, error, documentsError } = useAppSelector(state => state.akten);
  
  const [nodes, setNodes] = useState<HierarchyTree[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<(string | number)[]>([]);
  const [selectedCase, setSelectedCase] = useState('');

  // Load favorite Akten only once when component mounts and no data exists
  useEffect(() => {
    console.log(`🔍 CaseTabContent useEffect triggered: favouriteAkten.length=${favouriteAkten.length}, loading=${loading}`);
    
    if (favouriteAkten.length === 0 && !loading) {
      console.log('🔄 Loading favorite Akten from API (no cache found)...');
      dispatch(getFavoriteAktenAsync({ 
        NurFavoriten: true,
        Count: 50 // Limit to 50 favorite cases
      }));
    } else if (favouriteAkten.length > 0) {
      console.log(`✅ Using existing cached favorite Akten: ${favouriteAkten.length} cases`);
    } else if (loading) {
      console.log('⏳ Already loading favorites, skipping...');
    }
  }, [dispatch, favouriteAkten.length]); // Keep favouriteAkten.length as dependency to detect when it becomes empty

  // Transform favorite Akten and documents into HierarchyTree format with folder structure
  useEffect(() => {
    const transformedNodes: HierarchyTree[] = [];

    // Add favorite Akten as root nodes (AktenResponse format: Id, AKurz, Causa)
    favouriteAkten.forEach((akt) => {
      const aktNode: HierarchyTree = {
        id: akt.Id, // Use actual Akt ID as node ID
        rootId: -1, // Top-level nodes have rootId = -1
        name: `${akt.AKurz || 'Unknown'}`,
        isStructure: true, // This is a folder (Akt)
        hasChild: true,
        causa: akt.Causa || '',
        hasUrl: false,
        url: `akt:${akt.Id}`, // Store Akt ID in URL for identification
      };
      transformedNodes.push(aktNode);
    });

    // Process documents and create folder structure
    const folderMap = new Map<string, HierarchyTree>();
    let nextId = Math.max(...favouriteAkten.map(a => a.Id), 0) + 10000; // Start IDs after Akt IDs

    selectedAktDocuments.forEach((doc) => {
      // Find the parent Akt ID
      const parentAkt = favouriteAkten.find(akt => akt.Id === doc.aktId);
      
      if (parentAkt && doc.dateipfad) {
        // Parse the file path to create folder structure
        const pathParts = doc.dateipfad.split('/').filter(part => part.length > 0);
        const fileName = pathParts.pop() || doc.betreff || 'Unknown File';
        
        let currentParentId = parentAkt.Id;
        
        // Create folder hierarchy
        pathParts.forEach((folderName, index) => {
          const folderPath = pathParts.slice(0, index + 1).join('/');
          const folderKey = `${parentAkt.Id}:${folderPath}`;
          
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

        // Add the actual file
        const fileNode: HierarchyTree = {
          id: nextId++,
          rootId: currentParentId, // Parent is the deepest folder or the Akt itself
          name: fileName,
          isStructure: false, // This is a file
          hasChild: false,
          causa: '',
          hasUrl: !!doc.dateipfad,
          url: doc.dateipfad || '',
        };
        transformedNodes.push(fileNode);
      }
    });

    setNodes(transformedNodes);
  }, [favouriteAkten, selectedAktDocuments]);

  const onSelectionChanged = useCallback((e) => {
    // keep expandedKeys in sync
    setExpandedKeys(e.component.getSelectedRowKeys());
  }, []);

  // Handle expanding nodes to load documents
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
        
        // Only load documents if they haven't been loaded for this Akt yet
        const hasDocuments = nodes.some(n => n.rootId === aktId && !n.isStructure);
        if (!hasDocuments && !documentsLoading) {
          dispatch(getAktDokumenteAsync({ aktId, limit: 100 }));
        }
      }
    });
  }, [nodes, expandedKeys, documentsLoading, dispatch]);


  const handleOpen = useCallback((node: HierarchyTree) => {
    if (node.isStructure && node.url.startsWith('akt:')) {
      // This is an Akt node, load its documents (handled by expand event)
      const currentExpanded = [...expandedKeys];
      if (!currentExpanded.includes(node.id)) {
        currentExpanded.push(node.id);
        onExpandedRowKeysChange(currentExpanded);
      }
    } else if (!node.isStructure && node.url) {
      // This is a document, open the file
      console.log(`Opening document URL: ${node.url}`);
      window.open(node.url, '_blank');
    }
  }, [expandedKeys, onExpandedRowKeysChange]);

  const handleAdd = useCallback(async (node: HierarchyTree) => {
    if (node.isStructure) return; // Can't add Akt folders as attachments
    
    // For documents, we need to get the file content using the dateipfad
    try {
      const base64 = await getFileContent(node.id); // This might need to be adapted
      
      await new Promise<void>((resolve, reject) => {
        Office.context.mailbox.item.addFileAttachmentFromBase64Async(
          base64, 
          node.name,
          { isInline: false },
          result => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              resolve();
            } else { 
              console.log(result);
              reject(result.error);
            }
          }
        );
      });
    } catch (error) {
      console.error('Failed to add attachment:', error);
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
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: loading ? '#ccc' : '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Loading...' : 'Reload Favorites'}
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
          wordWrapEnabled={true}  // Enable word wrapping for long text
          rowAlternationEnabled={true}  // Better visual separation for wrapped rows
          height={400}
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
          width="calc(100% - 140px)"  // Take remaining space minus fixed button column width (with padding)
          minWidth={200}  // Minimum width to ensure readability
          allowResizing={true}  // Allow user to resize the name column
          cellRender={({ data }: { data: HierarchyTree }) => (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'flex-start',  // Align to top for multi-line content
                gap: 8,
                padding: '4px 0',  // Add some vertical padding
                lineHeight: '1.4',  // Better line height for readability
                wordBreak: 'break-word',  // Break long words if necessary
                whiteSpace: 'normal'  // Allow normal text wrapping
              }}
              title={data.name}  // Still show full name on hover as backup
            >
              <i
                className={
                  data.isStructure
                    ? 'dx-icon dx-icon-folder'
                    : 'dx-icon dx-icon-file'
                }
                style={{ 
                  marginTop: '2px',  // Slight adjustment to align with first line of text
                  flexShrink: 0  // Prevent icon from shrinking
                }}
              />
              <span style={{ wordWrap: 'break-word' }}>
                {data.name}
              </span>
            </div>
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
          visible={({ row }) => {
            const isVisible = !row.data.isStructure;
            console.log(`🔍 Open button visibility for "${row.data.name}": isStructure=${row.data.isStructure}, visible=${isVisible}`);
            return isVisible;
          }}
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
          name="delete"
          onClick={({ row }) => handleDelete(row.data)}
          visible={({ row }) => row.data.rootId === -1}
        />
      </Column>
      </TreeList>
      </div>
    </div>
  );
};
export default CaseTabContent;
