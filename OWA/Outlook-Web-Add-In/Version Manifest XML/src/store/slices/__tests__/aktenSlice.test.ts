/**
 * Unit Tests for aktenSlice
 * Tests all reducers, async thunks, selectors, and state transitions
 */

import aktenReducer, {
  clearCases,
  clearEmailDocuments,
  clearCaseDocuments,
  clearFavorites,
  clearFolders,
  setSelectedAkt,
  setSearchTerm,
  getFavoriteAktenAsync,
  getCaseDocumentsAsync,
  getEmailDocumentsAsync,
  addAktToFavoriteAsync,
  removeAktFromFavoriteAsync,
  getAvailableFoldersAsync,
  downloadDocumentAsync,
  aktLookUpAsync,
  selectCachedDocumentsForAkt,
  selectHasCachedDocumentsForAkt,
  selectEmailDocuments,
  selectEmailDocumentsForAktAndEmail,
  FolderOption,
  CachedAktDocuments,
} from '../aktenSlice';
import { AktLookUpResponse, AktenResponse } from '../../../taskpane/components/interfaces/IAkten';
import { DokumentResponse } from '../../../taskpane/components/interfaces/IDocument';
import { createMockWebRTCService, setupDefaultWebRTCMocks, cleanupTests, createTestStore } from '../testHelpers';
import {
  createMockAkt,
  createMockDocument,
  createMockCachedAktDocuments,
  createMockFolderOption,
} from './testFactories';

// Create mock WebRTC service
const mockWebRTCService = createMockWebRTCService();

// Mock WebRTC connection manager
jest.mock('../../../taskpane/services/WebRTCConnectionManager', () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => mockWebRTCService),
  })),
}));

describe('aktenSlice', () => {
  beforeEach(() => {
    cleanupTests();
    
    // Setup default mock implementations
    setupDefaultWebRTCMocks(mockWebRTCService);
    
    // Override specific defaults for aktenSlice tests
    // GetDocuments mock simulates real API behavior - returns documents matching the aktId parameter
    mockWebRTCService.GetDocuments.mockImplementation((_aktId: number) => 
      Promise.resolve({ 
        statusCode: 200, 
        body: '[]' // Can be overridden in individual tests with documents matching aktId
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Initial state for tests
  const initialState = {
    cases: [],
    searchTerm: '',
    previousSearchTerm: null,
    selectedAkt: null,
    loading: false,
    error: null,
    favouriteAkten: [],
    favoritesLoading: false,
    favoritesLoaded: false,
    addToFavoriteLoading: false,
    addingToFavoriteAktId: null,
    removeFromFavoriteLoading: false,
    removingFromFavoriteAktId: null,
    caseDocumentsCache: [],
    caseDocumentsLoading: false,
    loadingCaseDocumentsForAktId: null,
    caseDocumentsError: null,
    emailDocuments: [],
    emailDocumentsLoadedForAktId: null,
    emailDocumentsLoadedForEmailId: null,
    emailDocumentsLoading: false,
    loadingEmailDocumentsForAktId: null,
    emailDocumentsError: null,
    folderOptions: [],
    foldersLoadedForAktId: null,
    foldersLoading: false,
    foldersError: null,
  };

  // Mock data - using factory functions
  const mockAktLookup = createMockAkt();
  const mockAktenResponse = createMockAkt();
  const mockDocument = createMockDocument();
  const mockFolderOption = createMockFolderOption();

  describe('Reducer', () => {
    it('should return the initial state', () => {
      expect(aktenReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    describe('clearCases', () => {
      it('should clear cases and related state', () => {
        const stateWithData = {
          ...initialState,
          cases: [mockAktLookup],
          selectedAkt: mockAktLookup,
          caseDocumentsCache: [createMockCachedAktDocuments()],
          error: 'Some error',
          caseDocumentsError: 'Document error',
        };

        const actual = aktenReducer(stateWithData, clearCases());

        expect(actual.cases).toEqual([]);
        expect(actual.selectedAkt).toBeNull();
        expect(actual.caseDocumentsCache).toEqual([]);
        expect(actual.error).toBeNull();
        expect(actual.caseDocumentsError).toBeNull();
      });

      it('should NOT clear favorite Akten', () => {
        const stateWithFavorites = {
          ...initialState,
          favouriteAkten: [mockAktenResponse],
          cases: [mockAktLookup],
        };

        const actual = aktenReducer(stateWithFavorites, clearCases());

        expect(actual.favouriteAkten).toEqual([mockAktenResponse]);
      });
    });

    describe('clearEmailDocuments', () => {
      it('should clear email documents and related state', () => {
        const stateWithEmailDocs = {
          ...initialState,
          emailDocuments: [mockDocument],
          emailDocumentsLoadedForAktId: 1,
          emailDocumentsLoadedForEmailId: 'email123',
          emailDocumentsError: 'Error',
        };

        const actual = aktenReducer(stateWithEmailDocs, clearEmailDocuments());

        expect(actual.emailDocuments).toEqual([]);
        expect(actual.emailDocumentsLoadedForAktId).toBeNull();
        expect(actual.emailDocumentsLoadedForEmailId).toBeNull();
        expect(actual.emailDocumentsError).toBeNull();
      });
    });

    describe('clearCaseDocuments', () => {
      it('should clear case documents cache', () => {
        const stateWithCache = {
          ...initialState,
          caseDocumentsCache: [createMockCachedAktDocuments()],
          caseDocumentsError: 'Error',
        };

        const actual = aktenReducer(stateWithCache, clearCaseDocuments());

        expect(actual.caseDocumentsCache).toEqual([]);
        expect(actual.caseDocumentsError).toBeNull();
      });
    });

    describe('clearFavorites', () => {
      it('should clear favorites and case documents cache', () => {
        const stateWithFavorites = {
          ...initialState,
          favouriteAkten: [mockAktenResponse],
          favoritesLoaded: true,
          caseDocumentsCache: [createMockCachedAktDocuments()],
        };

        const actual = aktenReducer(stateWithFavorites, clearFavorites());

        expect(actual.favouriteAkten).toEqual([]);
        expect(actual.favoritesLoaded).toBe(false);
        expect(actual.caseDocumentsCache).toEqual([]);
      });
    });

    describe('clearFolders', () => {
      it('should clear folder options and related state', () => {
        const stateWithFolders = {
          ...initialState,
          folderOptions: [mockFolderOption],
          foldersLoadedForAktId: 1,
          foldersError: 'Error',
        };

        const actual = aktenReducer(stateWithFolders, clearFolders());

        expect(actual.folderOptions).toEqual([]);
        expect(actual.foldersLoadedForAktId).toBeNull();
        expect(actual.foldersError).toBeNull();
      });
    });

    describe('setSelectedAkt', () => {
      it('should set selected Akt', () => {
        const actual = aktenReducer(initialState, setSelectedAkt(mockAktLookup));

        expect(actual.selectedAkt).toEqual(mockAktLookup);
      });

      it('should clear selected Akt when null is provided', () => {
        const stateWithSelected = {
          ...initialState,
          selectedAkt: mockAktLookup,
        };

        const actual = aktenReducer(stateWithSelected, setSelectedAkt(null));

        expect(actual.selectedAkt).toBeNull();
      });
    });

    describe('setSearchTerm', () => {
      it('should set search term', () => {
        const actual = aktenReducer(initialState, setSearchTerm('test search'));

        expect(actual.searchTerm).toBe('test search');
      });

      it('should update existing search term', () => {
        const stateWithSearch = {
          ...initialState,
          searchTerm: 'old search',
        };

        const actual = aktenReducer(stateWithSearch, setSearchTerm('new search'));

        expect(actual.searchTerm).toBe('new search');
      });
    });
  });

  describe('Async Thunks', () => {
    describe('getFavoriteAktenAsync', () => {
      it('should handle pending state', () => {
        const action = { type: getFavoriteAktenAsync.pending.type };
        const actual = aktenReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(true);
        expect(actual.error).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const payload = [mockAktenResponse];
        const action = { type: getFavoriteAktenAsync.fulfilled.type, payload };
        const actual = aktenReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.favoritesLoaded).toBe(true);
        expect(actual.favouriteAkten).toEqual(payload);
      });

      it('should handle rejected state', () => {
        const action = {
          type: getFavoriteAktenAsync.rejected.type,
          error: { message: 'Network error' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.error).toBe('Network error');
      });

      it('should handle API errors with non-200 status codes (500)', () => {
        const action = {
          type: getFavoriteAktenAsync.rejected.type,
          error: { message: 'Server error: 500' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.error).toBe('Server error: 500');
        expect(actual.favouriteAkten).toEqual([]);
      });

      it('should handle API errors with non-200 status codes (404)', () => {
        const action = {
          type: getFavoriteAktenAsync.rejected.type,
          error: { message: 'Not found: 404' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.error).toBe('Not found: 404');
      });

      it('should handle API errors with non-200 status codes (401)', () => {
        const action = {
          type: getFavoriteAktenAsync.rejected.type,
          error: { message: 'Unauthorized: 401' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.error).toBe('Unauthorized: 401');
      });
    });

    describe('getCaseDocumentsAsync', () => {
      it('should handle pending state', () => {
        const action = {
          type: getCaseDocumentsAsync.pending.type,
          meta: { arg: { aktId: 1 } },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.caseDocumentsLoading).toBe(true);
        expect(actual.loadingCaseDocumentsForAktId).toBe(1);
        expect(actual.caseDocumentsError).toBeNull();
      });

      it('should handle fulfilled state and add to cache', () => {
        const payload = { aktId: 1, documents: [mockDocument], fromCache: false };
        const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
        const actual = aktenReducer(initialState, action);

        expect(actual.caseDocumentsLoading).toBe(false);
        expect(actual.loadingCaseDocumentsForAktId).toBeNull();
        expect(actual.caseDocumentsCache).toHaveLength(1);
        expect(actual.caseDocumentsCache[0].aktId).toBe(1);
        expect(actual.caseDocumentsCache[0].documents).toEqual([mockDocument]);
      });

      it('should update existing cache entry for same aktId', () => {
        const existingCache = {
          ...initialState,
          caseDocumentsCache: [
            createMockCachedAktDocuments({ loadedAt: Date.now() - 1000 }),
          ],
        };

        const newDocument = createMockDocument({ id: 2, betreff: 'New Document' });
        const payload = { aktId: 1, documents: [newDocument], fromCache: false };
        const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
        const actual = aktenReducer(existingCache, action);

        expect(actual.caseDocumentsCache).toHaveLength(1);
        expect(actual.caseDocumentsCache[0].documents).toEqual([newDocument]);
      });

      it('should implement LRU cache (keep only 5 most recent)', () => {
        const oldTimestamp = Date.now() - 10000;
        const stateWith5Cached = {
          ...initialState,
          caseDocumentsCache: [
            createMockCachedAktDocuments({ aktId: 1, documents: [], loadedAt: oldTimestamp }), // Oldest
            createMockCachedAktDocuments({ aktId: 2, documents: [], loadedAt: oldTimestamp + 1000 }),
            createMockCachedAktDocuments({ aktId: 3, documents: [], loadedAt: oldTimestamp + 2000 }),
            createMockCachedAktDocuments({ aktId: 4, documents: [], loadedAt: oldTimestamp + 3000 }),
            createMockCachedAktDocuments({ aktId: 5, documents: [], loadedAt: oldTimestamp + 4000 }), // Newest of existing
          ],
        };

        const payload = { aktId: 6, documents: [mockDocument], fromCache: false };
        const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
        const actual = aktenReducer(stateWith5Cached, action);

        expect(actual.caseDocumentsCache).toHaveLength(5);
        // Verify the oldest (aktId: 1) was removed
        expect(actual.caseDocumentsCache.find(c => c.aktId === 1)).toBeUndefined();
        // Verify the new entry was added
        expect(actual.caseDocumentsCache.find(c => c.aktId === 6)).toBeDefined();
        // Verify newest entry has most recent timestamp
        const newestEntry = actual.caseDocumentsCache.find(c => c.aktId === 6);
        expect(newestEntry?.loadedAt).toBeGreaterThan(oldTimestamp + 4000);
      });

      it('should handle rejected state', () => {
        const action = {
          type: getCaseDocumentsAsync.rejected.type,
          meta: { arg: { aktId: 1 } },
          error: { message: 'Failed to load' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.caseDocumentsLoading).toBe(false);
        expect(actual.loadingCaseDocumentsForAktId).toBeNull();
        expect(actual.caseDocumentsError).toBe('Failed to load');
      });

      it('should handle rejected state with undefined error', () => {
        const action = {
          type: getCaseDocumentsAsync.rejected.type,
          meta: { arg: { aktId: 1 } },
          error: {},
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.caseDocumentsLoading).toBe(false);
        expect(actual.caseDocumentsError).toBe('Failed to get documents for Akt');
      });

      it('should handle API error with code', () => {
        const action = {
          type: getCaseDocumentsAsync.rejected.type,
          meta: { arg: { aktId: 1 } },
          error: { 
            message: 'Network error',
            code: 'NETWORK_ERROR' 
          },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.caseDocumentsError).toBe('Network error');
      });
    });

    describe('getEmailDocumentsAsync', () => {
      it('should handle pending state', () => {
        const action = {
          type: getEmailDocumentsAsync.pending.type,
          meta: { arg: { aktId: 1, outlookEmailId: 'email123' } },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.emailDocumentsLoading).toBe(true);
        expect(actual.loadingEmailDocumentsForAktId).toBe(1);
        expect(actual.emailDocumentsError).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const payload = [mockDocument];
        const action = {
          type: getEmailDocumentsAsync.fulfilled.type,
          payload,
          meta: { arg: { aktId: 1, outlookEmailId: 'email123' } },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.emailDocumentsLoading).toBe(false);
        expect(actual.loadingEmailDocumentsForAktId).toBeNull();
        expect(actual.emailDocuments).toEqual(payload);
        expect(actual.emailDocumentsLoadedForAktId).toBe(1);
        expect(actual.emailDocumentsLoadedForEmailId).toBe('email123');
      });

      it('should handle rejected state', () => {
        const action = {
          type: getEmailDocumentsAsync.rejected.type,
          meta: { arg: { aktId: 1 } },
          error: { message: 'Failed to load email docs' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.emailDocumentsLoading).toBe(false);
        expect(actual.loadingEmailDocumentsForAktId).toBeNull();
        expect(actual.emailDocumentsError).toBe('Failed to load email docs');
        expect(actual.emailDocumentsLoadedForAktId).toBeNull();
        expect(actual.emailDocumentsLoadedForEmailId).toBeNull();
      });

      it('should handle API errors with non-200 status codes (500)', () => {
        const action = {
          type: getEmailDocumentsAsync.rejected.type,
          meta: { arg: { aktId: 1, emailId: 'email-1' } },
          error: { message: 'Internal Server Error: 500' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.emailDocumentsLoading).toBe(false);
        expect(actual.emailDocumentsError).toBe('Internal Server Error: 500');
      });

      it('should handle API errors with non-200 status codes (404)', () => {
        const action = {
          type: getEmailDocumentsAsync.rejected.type,
          meta: { arg: { aktId: 1, emailId: 'email-1' } },
          error: { message: 'Not Found: 404' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.emailDocumentsLoading).toBe(false);
        expect(actual.emailDocumentsError).toBe('Not Found: 404');
      });
    });

    describe('addAktToFavoriteAsync', () => {
      it('should handle pending state', () => {
        const action = {
          type: addAktToFavoriteAsync.pending.type,
          meta: { arg: 1 },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.addToFavoriteLoading).toBe(true);
        expect(actual.addingToFavoriteAktId).toBe(1);
        expect(actual.error).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const stateWithPending = {
          ...initialState,
          addToFavoriteLoading: true,
          addingToFavoriteAktId: 1,
        };

        const action = { type: addAktToFavoriteAsync.fulfilled.type };
        const actual = aktenReducer(stateWithPending, action);

        expect(actual.addToFavoriteLoading).toBe(false);
        expect(actual.addingToFavoriteAktId).toBeNull();
      });

      it('should handle rejected state', () => {
        const action = {
          type: addAktToFavoriteAsync.rejected.type,
          error: { message: 'Failed to add' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.addToFavoriteLoading).toBe(false);
        expect(actual.addingToFavoriteAktId).toBeNull();
        expect(actual.error).toBe('Failed to add');
      });

      it('should handle API errors with non-200 status codes (409 - already exists)', () => {
        const action = {
          type: addAktToFavoriteAsync.rejected.type,
          meta: { arg: 1 },
          error: { message: 'Conflict: 409 - Already in favorites' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.addToFavoriteLoading).toBe(false);
        expect(actual.error).toBe('Conflict: 409 - Already in favorites');
      });
    });

    describe('removeAktFromFavoriteAsync', () => {
      it('should handle pending state', () => {
        const action = {
          type: removeAktFromFavoriteAsync.pending.type,
          meta: { arg: 1 },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.removeFromFavoriteLoading).toBe(true);
        expect(actual.removingFromFavoriteAktId).toBe(1);
        expect(actual.error).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const stateWithPending = {
          ...initialState,
          removeFromFavoriteLoading: true,
          removingFromFavoriteAktId: 1,
        };

        const action = { type: removeAktFromFavoriteAsync.fulfilled.type };
        const actual = aktenReducer(stateWithPending, action);

        expect(actual.removeFromFavoriteLoading).toBe(false);
        expect(actual.removingFromFavoriteAktId).toBeNull();
      });

      it('should handle rejected state', () => {
        const action = {
          type: removeAktFromFavoriteAsync.rejected.type,
          error: { message: 'Failed to remove' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.removeFromFavoriteLoading).toBe(false);
        expect(actual.removingFromFavoriteAktId).toBeNull();
        expect(actual.error).toBe('Failed to remove');
      });

      it('should handle API errors with non-200 status codes (404 - not found)', () => {
        const action = {
          type: removeAktFromFavoriteAsync.rejected.type,
          meta: { arg: 1 },
          error: { message: 'Not Found: 404 - Not in favorites' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.removeFromFavoriteLoading).toBe(false);
        expect(actual.error).toBe('Not Found: 404 - Not in favorites');
      });
    });

    describe('getAvailableFoldersAsync', () => {
      it('should handle pending state', () => {
        const action = { type: getAvailableFoldersAsync.pending.type };
        const actual = aktenReducer(initialState, action);

        expect(actual.foldersLoading).toBe(true);
        expect(actual.foldersError).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const payload = [mockFolderOption];
        const action = {
          type: getAvailableFoldersAsync.fulfilled.type,
          payload,
          meta: { arg: 1 },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.foldersLoading).toBe(false);
        expect(actual.folderOptions).toEqual(payload);
        expect(actual.foldersLoadedForAktId).toBe(1);
      });

      it('should handle rejected state', () => {
        const action = {
          type: getAvailableFoldersAsync.rejected.type,
          error: { message: 'Failed to load folders' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.foldersLoading).toBe(false);
        expect(actual.foldersError).toBe('Failed to load folders');
        expect(actual.folderOptions).toEqual([]);
        expect(actual.foldersLoadedForAktId).toBeNull();
      });

      it('should handle API errors with non-200 status codes (403 - forbidden)', () => {
        const action = {
          type: getAvailableFoldersAsync.rejected.type,
          meta: { arg: 1 },
          error: { message: 'Forbidden: 403 - Access denied' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.foldersLoading).toBe(false);
        expect(actual.foldersError).toBe('Forbidden: 403 - Access denied');
      });
    });

    describe('aktLookUpAsync', () => {
      it('should handle pending state and set search term', () => {
        const action = {
          type: aktLookUpAsync.pending.type,
          meta: { arg: 'test search' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.loading).toBe(true);
        expect(actual.error).toBeNull();
        expect(actual.searchTerm).toBe('test search');
      });

      it('should handle fulfilled state', () => {
        const payload = [mockAktLookup];
        const action = { type: aktLookUpAsync.fulfilled.type, payload };
        const actual = aktenReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.cases).toEqual(payload);
      });

      it('should handle rejected state', () => {
        const action = {
          type: aktLookUpAsync.rejected.type,
          error: { message: 'Search failed' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.error).toBe('Search failed');
      });

      it('should handle API errors with non-200 status codes (503 - service unavailable)', () => {
        const action = {
          type: aktLookUpAsync.rejected.type,
          error: { message: 'Service Unavailable: 503' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.error).toBe('Service Unavailable: 503');
      });

      it('should handle API errors with non-200 status codes (429 - rate limit)', () => {
        const action = {
          type: aktLookUpAsync.rejected.type,
          error: { message: 'Too Many Requests: 429' },
        };
        const actual = aktenReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.error).toBe('Too Many Requests: 429');
      });
    });
  });

  describe('Selectors', () => {
    const mockState = {
      akten: {
        ...initialState,
        caseDocumentsCache: [
          createMockCachedAktDocuments({ aktId: 1, documents: [mockDocument] }),
          createMockCachedAktDocuments({ aktId: 2, documents: [] }),
        ],
        emailDocuments: [mockDocument],
        emailDocumentsLoadedForAktId: 1,
        emailDocumentsLoadedForEmailId: 'email123',
      },
    };

    describe('selectCachedDocumentsForAkt', () => {
      it('should return documents for cached aktId', () => {
        const result = selectCachedDocumentsForAkt(mockState, 1);
        expect(result).toEqual([mockDocument]);
      });

      it('should return empty array for non-cached aktId', () => {
        const result = selectCachedDocumentsForAkt(mockState, 999);
        expect(result).toEqual([]);
      });
    });

    describe('selectHasCachedDocumentsForAkt', () => {
      it('should return true for cached aktId', () => {
        const result = selectHasCachedDocumentsForAkt(mockState, 1);
        expect(result).toBe(true);
      });

      it('should return false for non-cached aktId', () => {
        const result = selectHasCachedDocumentsForAkt(mockState, 999);
        expect(result).toBe(false);
      });
    });

    describe('selectEmailDocuments', () => {
      it('should return email documents', () => {
        const result = selectEmailDocuments(mockState);
        expect(result).toEqual([mockDocument]);
      });
    });

    describe('selectEmailDocumentsForAktAndEmail', () => {
      it('should return documents when aktId and emailId match', () => {
        const result = selectEmailDocumentsForAktAndEmail(mockState, 1, 'email123');
        expect(result).toEqual([mockDocument]);
      });

      it('should return documents when aktId matches and no emailId provided', () => {
        const result = selectEmailDocumentsForAktAndEmail(mockState, 1);
        expect(result).toEqual([mockDocument]);
      });

      it('should return empty array when aktId does not match', () => {
        const result = selectEmailDocumentsForAktAndEmail(mockState, 2, 'email123');
        expect(result).toEqual([]);
      });

      it('should return empty array when emailId does not match', () => {
        const result = selectEmailDocumentsForAktAndEmail(mockState, 1, 'different-email');
        expect(result).toEqual([]);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty cache in selectCachedDocumentsForAkt', () => {
        const emptyState = { akten: { ...initialState, caseDocumentsCache: [] } };
        const result = selectCachedDocumentsForAkt(emptyState, 1);
        expect(result).toEqual([]);
      });

      it('should handle empty email documents', () => {
        const emptyState = { akten: { ...initialState, emailDocuments: [] } };
        const result = selectEmailDocuments(emptyState);
        expect(result).toEqual([]);
      });

      it('should handle null aktId in selectEmailDocumentsForAktAndEmail', () => {
        const result = selectEmailDocumentsForAktAndEmail(mockState, null as any, 'email123');
        expect(result).toEqual([]);
      });

      it('should handle mismatched aktId and emailId', () => {
        const result = selectEmailDocumentsForAktAndEmail(mockState, 999, 'email123');
        expect(result).toEqual([]);
      });
    });
  });

  describe('State Transitions', () => {
    it('should handle complete favorite workflow', () => {
      let state = initialState;

      // Load favorites
      state = aktenReducer(state, { type: getFavoriteAktenAsync.pending.type });
      expect(state.favoritesLoading).toBe(true);

      state = aktenReducer(state, {
        type: getFavoriteAktenAsync.fulfilled.type,
        payload: [mockAktenResponse],
      });
      expect(state.favoritesLoaded).toBe(true);
      expect(state.favouriteAkten).toHaveLength(1);

      // Add to favorites
      state = aktenReducer(state, {
        type: addAktToFavoriteAsync.pending.type,
        meta: { arg: 2 },
      });
      expect(state.addingToFavoriteAktId).toBe(2);

      state = aktenReducer(state, { type: addAktToFavoriteAsync.fulfilled.type });
      expect(state.addToFavoriteLoading).toBe(false);

      // Remove from favorites
      state = aktenReducer(state, {
        type: removeAktFromFavoriteAsync.pending.type,
        meta: { arg: 1 },
      });
      expect(state.removingFromFavoriteAktId).toBe(1);

      state = aktenReducer(state, { type: removeAktFromFavoriteAsync.fulfilled.type });
      expect(state.removeFromFavoriteLoading).toBe(false);
    });

    it('should handle document caching workflow', () => {
      let state = initialState;

      // Load documents for Akt 1
      state = aktenReducer(state, {
        type: getCaseDocumentsAsync.fulfilled.type,
        payload: { aktId: 1, documents: [mockDocument], fromCache: false },
      });
      expect(state.caseDocumentsCache).toHaveLength(1);

      // Load documents for Akt 2
      const doc2 = createMockDocument({ id: 2, aktId: 2 });
      state = aktenReducer(state, {
        type: getCaseDocumentsAsync.fulfilled.type,
        payload: { aktId: 2, documents: [doc2], fromCache: false },
      });
      expect(state.caseDocumentsCache).toHaveLength(2);

      // Clear cache
      state = aktenReducer(state, clearCaseDocuments());
      expect(state.caseDocumentsCache).toEqual([]);
    });

    it('should handle search and selection workflow', () => {
      let state = initialState;

      // Start search
      state = aktenReducer(state, setSearchTerm('test'));
      expect(state.searchTerm).toBe('test');

      // Perform lookup
      state = aktenReducer(state, {
        type: aktLookUpAsync.fulfilled.type,
        payload: [mockAktLookup],
      });
      expect(state.cases).toHaveLength(1);

      // Select an Akt
      state = aktenReducer(state, setSelectedAkt(mockAktLookup));
      expect(state.selectedAkt).toEqual(mockAktLookup);

      // Clear search
      state = aktenReducer(state, clearCases());
      expect(state.cases).toEqual([]);
      expect(state.selectedAkt).toBeNull();
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle very large number of cached documents', () => {
      const largeDocumentArray = Array.from({ length: 1000 }, (_, i) => 
        createMockDocument({ id: i + 1 })
      );
      
      const payload = { aktId: 1, documents: largeDocumentArray, fromCache: false };
      const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
      const state = aktenReducer(initialState, action);
      
      expect(state.caseDocumentsCache[0].documents).toHaveLength(1000);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple pending states independently', () => {
      let state = initialState;
      
      // Start loading favorites
      state = aktenReducer(state, { type: getFavoriteAktenAsync.pending.type });
      expect(state.favoritesLoading).toBe(true);
      
      // Start loading case documents (should not affect favorites loading)
      state = aktenReducer(state, { 
        type: getCaseDocumentsAsync.pending.type, 
        meta: { arg: { aktId: 1 } } 
      });
      expect(state.favoritesLoading).toBe(true); // Still loading
      expect(state.caseDocumentsLoading).toBe(true); // Also loading
      
      // Complete case documents (should not affect favorites loading)
      state = aktenReducer(state, {
        type: getCaseDocumentsAsync.fulfilled.type,
        payload: { aktId: 1, documents: [mockDocument], fromCache: false }
      });
      expect(state.favoritesLoading).toBe(true); // Still loading
      expect(state.caseDocumentsLoading).toBe(false); // Completed
    });
  });

  describe('Cache Management', () => {
    it('should handle cache timestamp updates correctly', () => {
      const oldTimestamp = Date.now() - 5000;
      const stateWithCache = {
        ...initialState,
        caseDocumentsCache: [
          createMockCachedAktDocuments({ loadedAt: oldTimestamp })
        ]
      };

      const updatedDoc = createMockDocument({ betreff: 'Updated Document' });
      const payload = { aktId: 1, documents: [updatedDoc], fromCache: false };
      const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
      const state = aktenReducer(stateWithCache, action);

      expect(state.caseDocumentsCache[0].loadedAt).toBeGreaterThan(oldTimestamp);
      expect(state.caseDocumentsCache[0].documents[0].betreff).toBe('Updated Document');
    });

    it('should prevent duplicate aktIds in cache', () => {
      const stateWithDuplicates = {
        ...initialState,
        caseDocumentsCache: [
          createMockCachedAktDocuments({ aktId: 1, documents: [mockDocument], loadedAt: Date.now() }),
          createMockCachedAktDocuments({ aktId: 1, documents: [createMockDocument({ id: 2 })], loadedAt: Date.now() + 1000 })
        ]
      };

      const payload = { aktId: 1, documents: [createMockDocument({ id: 3 })], fromCache: false };
      const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
      const state = aktenReducer(stateWithDuplicates, action);

      // Should have only one entry for aktId 1 with the newest documents
      const entriesForAkt1 = state.caseDocumentsCache.filter(c => c.aktId === 1);
      expect(entriesForAkt1).toHaveLength(1);
      expect(entriesForAkt1[0].documents[0].id).toBe(3);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from error state on subsequent successful calls', () => {
      let state = initialState;
      
      // First, trigger an error
      state = aktenReducer(state, {
        type: getFavoriteAktenAsync.rejected.type,
        error: { message: 'Initial error' }
      });
      expect(state.error).toBe('Initial error');

      // Then, pending call should clear error
      state = aktenReducer(state, {
        type: getFavoriteAktenAsync.pending.type
      });
      expect(state.error).toBeNull();
      expect(state.favoritesLoading).toBe(true);

      // Fulfilled call completes successfully
      state = aktenReducer(state, {
        type: getFavoriteAktenAsync.fulfilled.type,
        payload: [createMockAkt()]
      });
      expect(state.error).toBeNull();
      expect(state.favouriteAkten).toHaveLength(1);
      expect(state.favoritesLoading).toBe(false);
    });

    it('should handle undefined error in more thunks', () => {
      const action = { type: getFavoriteAktenAsync.rejected.type, error: {} };
      const state = aktenReducer(initialState, action);
      expect(state.error).toBeDefined();
    });
  });

  describe('Selector Performance', () => {
    it('should efficiently handle large state in selectCachedDocumentsForAkt', () => {
      const largeCache = Array.from({ length: 100 }, (_, i) => 
        createMockCachedAktDocuments({
          aktId: i + 1,
          documents: [createMockDocument({ id: i + 1 })],
          loadedAt: Date.now() + i
        })
      );

      const largeState = {
        akten: {
          ...initialState,
          caseDocumentsCache: largeCache
        }
      };

      const startTime = performance.now();
      const result = selectCachedDocumentsForAkt(largeState, 50);
      const endTime = performance.now();

      expect(result).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });
  });

  describe('Partial State Updates', () => {
    it('should preserve unrelated state during updates', () => {
      const initialStateWithData = {
        ...initialState,
        favouriteAkten: [createMockAkt()],
        searchTerm: 'existing search',
        folderOptions: [mockFolderOption]
      };

      const action = setSearchTerm('new search');
      const state = aktenReducer(initialStateWithData, action);

      expect(state.searchTerm).toBe('new search');
      // Verify unrelated state is preserved
      expect(state.favouriteAkten).toHaveLength(1);
      expect(state.folderOptions).toHaveLength(1);
    });

    it('should handle multiple pending actions correctly', () => {
      let state = initialState;
      state = aktenReducer(state, { type: getFavoriteAktenAsync.pending.type });
      state = aktenReducer(state, { type: getCaseDocumentsAsync.pending.type, meta: { arg: { aktId: 1 } } });
      expect(state.favoritesLoading && state.caseDocumentsLoading).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state when updating search term', () => {
      const originalState = { ...initialState };
      const newState = aktenReducer(originalState, setSearchTerm('New Search'));
      
      expect(originalState.searchTerm).toBe(''); // Unchanged
      expect(newState.searchTerm).toBe('New Search');
    });

    it('should not mutate original state when adding to cache', () => {
      const originalState = { ...initialState };
      const payload = { aktId: 1, documents: [mockDocument], fromCache: false };
      const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
      const newState = aktenReducer(originalState, action);
      
      expect(originalState.caseDocumentsCache).toHaveLength(0); // Unchanged
      expect(newState.caseDocumentsCache).toHaveLength(1);
    });

    it('should return new object references for cache array', () => {
      const originalState = {
        ...initialState,
        caseDocumentsCache: [
          { aktId: 1, documents: [mockDocument], loadedAt: Date.now() }
        ]
      };
      
      const payload = { aktId: 2, documents: [createMockDocument({ id: 2 })], fromCache: false };
      const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
      const newState = aktenReducer(originalState, action);
      
      expect(newState.caseDocumentsCache).not.toBe(originalState.caseDocumentsCache);
      expect(newState.caseDocumentsCache).toHaveLength(2);
    });

    it('should not mutate nested document arrays in cache', () => {
      const originalDocuments = [mockDocument];
      const originalState = {
        ...initialState,
        caseDocumentsCache: [
          { aktId: 1, documents: originalDocuments, loadedAt: Date.now() }
        ]
      };
      
      const updatedDoc = createMockDocument({ id: 2, betreff: 'Updated' });
      const payload = { aktId: 1, documents: [updatedDoc], fromCache: false };
      const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
      const newState = aktenReducer(originalState, action);
      
      // Original array unchanged
      expect(originalDocuments).toHaveLength(1);
      expect(originalDocuments[0].id).toBe(1);
      
      // New state has updated documents
      expect(newState.caseDocumentsCache[0].documents).toHaveLength(1);
      expect(newState.caseDocumentsCache[0].documents[0].id).toBe(2);
    });

    it('should preserve unmodified state when updating selected Akt', () => {
      const originalState = {
        ...initialState,
        favouriteAkten: [createMockAkt()],
        caseDocumentsCache: [
          { aktId: 1, documents: [mockDocument], loadedAt: Date.now() }
        ],
        searchTerm: 'existing',
      };
      
      const newAkt = createMockAkt({ id: 99, aKurz: 'NEW-001' });
      const newState = aktenReducer(originalState, setSelectedAkt(newAkt));
      
      // These should be unchanged
      expect(newState.favouriteAkten).toBe(originalState.favouriteAkten);
      expect(newState.caseDocumentsCache).toBe(originalState.caseDocumentsCache);
      expect(newState.searchTerm).toBe('existing');
      
      // Only selectedAkt changed
      expect(newState.selectedAkt).toEqual(newAkt);
    });

    it('should create new cache array reference when clearing', () => {
      const originalCache = [
        { aktId: 1, documents: [mockDocument], loadedAt: Date.now() }
      ];
      const originalState = {
        ...initialState,
        caseDocumentsCache: originalCache,
      };
      
      const newState = aktenReducer(originalState, clearCaseDocuments());
      
      expect(newState.caseDocumentsCache).not.toBe(originalCache);
      expect(newState.caseDocumentsCache).toEqual([]);
      expect(originalCache).toHaveLength(1); // Original unchanged
    });

    it('should preserve favorites when clearing cases', () => {
      const originalFavorites = [createMockAkt()];
      const originalState = {
        ...initialState,
        favouriteAkten: originalFavorites,
        cases: [createMockAkt({ id: 2 })],
        selectedAkt: createMockAkt({ id: 3 }),
      };
      
      const newState = aktenReducer(originalState, clearCases());
      
      expect(newState.favouriteAkten).toBe(originalFavorites); // Same reference
      expect(newState.cases).toEqual([]);
      expect(newState.selectedAkt).toBeNull();
    });
  });

  describe('WebRTC Service Error Handling', () => {
    describe('getFavoriteAktenAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.getFavoriteAkten.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getFavoriteAktenAsync({ NurFavoriten: true, Count: 10 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getFavoriteAkten/rejected');
        if (getFavoriteAktenAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.getFavoriteAkten.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getFavoriteAktenAsync({ NurFavoriten: true, Count: 10 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getFavoriteAkten/rejected');
        if (getFavoriteAktenAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });

      it('should handle response with null body', async () => {
        mockWebRTCService.getFavoriteAkten.mockResolvedValue({ 
          statusCode: 400, 
          body: null 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getFavoriteAktenAsync({ NurFavoriten: true, Count: 10 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getFavoriteAkten/rejected');
      });
    });

    describe('getCaseDocumentsAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.GetDocuments.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn(() => ({ akten: initialState }));
        
        const result = await getCaseDocumentsAsync({ aktId: 1 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getCaseDocuments/rejected');
        if (getCaseDocumentsAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.GetDocuments.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn(() => ({ akten: initialState }));
        
        const result = await getCaseDocumentsAsync({ aktId: 1 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getCaseDocuments/rejected');
        if (getCaseDocumentsAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });

      it('should handle non-200 status code (400 Bad Request)', async () => {
        mockWebRTCService.GetDocuments.mockResolvedValue({ 
          statusCode: 400, 
          body: 'Invalid aktId' 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn(() => ({ akten: initialState }));
        
        const result = await getCaseDocumentsAsync({ aktId: 1 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getCaseDocuments/rejected');
        if (getCaseDocumentsAsync.rejected.match(result)) {
          expect(result.error.message).toContain('Failed to get documents for Akt');
        }
      });
    });

    describe('getEmailDocumentsAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.GetDocuments.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getEmailDocumentsAsync({ aktId: 1, outlookEmailId: 'email1' })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getEmailDocuments/rejected');
        if (getEmailDocumentsAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.GetDocuments.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getEmailDocumentsAsync({ aktId: 1, outlookEmailId: 'email1' })(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/getEmailDocuments/rejected');
        if (getEmailDocumentsAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });
    });

    describe('addAktToFavoriteAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.addAktToFavorite.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await addAktToFavoriteAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/addAktToFavorite/rejected');
        if (addAktToFavoriteAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.addAktToFavorite.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await addAktToFavoriteAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/addAktToFavorite/rejected');
        if (addAktToFavoriteAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });
    });

    describe('removeAktFromFavoriteAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.removeAktFromFavorite.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await removeAktFromFavoriteAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/removeAktFromFavorite/rejected');
        if (removeAktFromFavoriteAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.removeAktFromFavorite.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await removeAktFromFavoriteAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/removeAktFromFavorite/rejected');
        if (removeAktFromFavoriteAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });
    });
  });

  describe('CachedAktDocuments Type and Structure', () => {
    describe('Factory Function', () => {
      it('should create valid CachedAktDocuments with default values', () => {
        const cached = createMockCachedAktDocuments();
        
        expect(cached).toHaveProperty('aktId');
        expect(cached).toHaveProperty('documents');
        expect(cached).toHaveProperty('loadedAt');
        expect(typeof cached.aktId).toBe('number');
        expect(Array.isArray(cached.documents)).toBe(true);
        expect(typeof cached.loadedAt).toBe('number');
      });

      it('should create CachedAktDocuments with custom aktId', () => {
        const cached = createMockCachedAktDocuments({ aktId: 999 });
        
        expect(cached.aktId).toBe(999);
      });

      it('should create CachedAktDocuments with empty documents array', () => {
        const cached = createMockCachedAktDocuments({ documents: [] });
        
        expect(cached.documents).toEqual([]);
      });

      it('should create CachedAktDocuments with multiple documents', () => {
        const docs = [
          createMockDocument({ id: 1 }),
          createMockDocument({ id: 2 }),
          createMockDocument({ id: 3 })
        ];
        const cached = createMockCachedAktDocuments({ documents: docs });
        
        expect(cached.documents).toHaveLength(3);
        expect(cached.documents[0].id).toBe(1);
        expect(cached.documents[2].id).toBe(3);
      });

      it('should create CachedAktDocuments with specific timestamp', () => {
        const specificTime = Date.now() - 100000;
        const cached = createMockCachedAktDocuments({ loadedAt: specificTime });
        
        expect(cached.loadedAt).toBe(specificTime);
      });
    });

    describe('Cache Entry Validation', () => {
      it('should maintain correct structure when added to state', () => {
        const cached = createMockCachedAktDocuments({ aktId: 5 });
        const payload = { aktId: 5, documents: cached.documents, fromCache: false };
        const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
        const state = aktenReducer(initialState, action);
        
        const addedEntry = state.caseDocumentsCache[0];
        expect(addedEntry).toHaveProperty('aktId');
        expect(addedEntry).toHaveProperty('documents');
        expect(addedEntry).toHaveProperty('loadedAt');
        expect(addedEntry.aktId).toBe(5);
      });

      it('should preserve all CachedAktDocuments properties during updates', () => {
        const oldCache = createMockCachedAktDocuments({ 
          aktId: 1, 
          documents: [createMockDocument({ id: 1 })],
          loadedAt: Date.now() - 5000
        });
        
        const stateWithCache = {
          ...initialState,
          caseDocumentsCache: [oldCache]
        };

        const newDoc = createMockDocument({ id: 2, betreff: 'Updated' });
        const payload = { aktId: 1, documents: [newDoc], fromCache: false };
        const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
        const newState = aktenReducer(stateWithCache, action);
        
        const updatedEntry = newState.caseDocumentsCache[0];
        expect(updatedEntry.aktId).toBe(1);
        expect(updatedEntry.documents).toHaveLength(1);
        expect(updatedEntry.documents[0].id).toBe(2);
        expect(updatedEntry.loadedAt).toBeGreaterThan(oldCache.loadedAt);
      });

      it('should handle CachedAktDocuments with different aktId values', () => {
        const cache1 = createMockCachedAktDocuments({ aktId: 1 });
        const cache2 = createMockCachedAktDocuments({ aktId: 2 });
        const cache3 = createMockCachedAktDocuments({ aktId: 3 });
        
        const stateWithMultipleCached = {
          ...initialState,
          caseDocumentsCache: [cache1, cache2, cache3]
        };
        
        expect(stateWithMultipleCached.caseDocumentsCache).toHaveLength(3);
        expect(stateWithMultipleCached.caseDocumentsCache[0].aktId).toBe(1);
        expect(stateWithMultipleCached.caseDocumentsCache[1].aktId).toBe(2);
        expect(stateWithMultipleCached.caseDocumentsCache[2].aktId).toBe(3);
      });
    });

    describe('Timestamp Management', () => {
      it('should use recent timestamp when creating new cache entry', () => {
        const beforeTime = Date.now();
        const cached = createMockCachedAktDocuments();
        const afterTime = Date.now();
        
        expect(cached.loadedAt).toBeGreaterThanOrEqual(beforeTime);
        expect(cached.loadedAt).toBeLessThanOrEqual(afterTime);
      });

      it('should update loadedAt timestamp when cache entry is refreshed', () => {
        const oldTimestamp = Date.now() - 10000;
        const oldCache = createMockCachedAktDocuments({ loadedAt: oldTimestamp });
        
        const stateWithOldCache = {
          ...initialState,
          caseDocumentsCache: [oldCache]
        };

        const payload = { aktId: 1, documents: [createMockDocument()], fromCache: false };
        const action = { type: getCaseDocumentsAsync.fulfilled.type, payload };
        const newState = aktenReducer(stateWithOldCache, action);
        
        expect(newState.caseDocumentsCache[0].loadedAt).toBeGreaterThan(oldTimestamp);
      });

      it('should maintain chronological order for LRU based on loadedAt', () => {
        const time1 = Date.now() - 3000;
        const time2 = Date.now() - 2000;
        const time3 = Date.now() - 1000;
        
        const cache = [
          createMockCachedAktDocuments({ aktId: 1, loadedAt: time1 }),
          createMockCachedAktDocuments({ aktId: 2, loadedAt: time2 }),
          createMockCachedAktDocuments({ aktId: 3, loadedAt: time3 })
        ];
        
        const sorted = [...cache].sort((a, b) => b.loadedAt - a.loadedAt);
        
        expect(sorted[0].aktId).toBe(3); // Most recent
        expect(sorted[1].aktId).toBe(2);
        expect(sorted[2].aktId).toBe(1); // Oldest
      });
    });

    describe('Documents Array Management', () => {
      it('should support empty documents array in CachedAktDocuments', () => {
        const cached = createMockCachedAktDocuments({ documents: [] });
        
        expect(cached.documents).toEqual([]);
        expect(cached.documents).toHaveLength(0);
      });

      it('should support single document in CachedAktDocuments', () => {
        const doc = createMockDocument({ id: 123 });
        const cached = createMockCachedAktDocuments({ documents: [doc] });
        
        expect(cached.documents).toHaveLength(1);
        expect(cached.documents[0].id).toBe(123);
      });

      it('should support large number of documents in CachedAktDocuments', () => {
        const manyDocs = Array.from({ length: 100 }, (_, i) => 
          createMockDocument({ id: i + 1 })
        );
        const cached = createMockCachedAktDocuments({ documents: manyDocs });
        
        expect(cached.documents).toHaveLength(100);
        expect(cached.documents[0].id).toBe(1);
        expect(cached.documents[99].id).toBe(100);
      });

      it('should maintain document references in CachedAktDocuments', () => {
        const doc1 = createMockDocument({ id: 1, betreff: 'Doc 1' });
        const doc2 = createMockDocument({ id: 2, betreff: 'Doc 2' });
        const cached = createMockCachedAktDocuments({ documents: [doc1, doc2] });
        
        expect(cached.documents[0]).toBe(doc1);
        expect(cached.documents[1]).toBe(doc2);
      });
    });
  });

  // Additional tests for branch coverage
  describe('Branch Coverage - Error Handling', () => {
    describe('aktLookUpAsync - non-200 status codes', () => {
      it('should handle rejected state with default error message', async () => {
        mockWebRTCService.aktLookUp.mockResolvedValue({ statusCode: 500, body: '' });
        
        const store = createTestStore();
        await store.dispatch(aktLookUpAsync('test') as any);
        
        const state = store.getState().akten;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to lookup cases');
      });
    });

    describe('getEmailDocumentsAsync - error paths', () => {
      it('should handle rejected state with default error message', async () => {
        mockWebRTCService.GetDocuments.mockResolvedValue({ statusCode: 500, body: '' });
        
        const store = createTestStore();
        await store.dispatch(getEmailDocumentsAsync({ aktId: 1 }) as any);
        
        const state = store.getState().akten;
        expect(state.emailDocumentsLoading).toBe(false);
        expect(state.emailDocumentsError).toBe('Failed to get documents for email');
      });

      it('should handle request without outlookEmailId parameter', async () => {
        mockWebRTCService.GetDocuments.mockImplementation((params) => {
          // Verify outlookEmailId is NOT in params when not provided
          expect(params.outlookEmailId).toBeUndefined();
          return Promise.resolve({ statusCode: 200, body: '[]' });
        });
        
        const store = createTestStore();
        await store.dispatch(getEmailDocumentsAsync({ aktId: 1 }) as any);
        
        const state = store.getState().akten;
        expect(state.emailDocumentsLoading).toBe(false);
        expect(state.emailDocuments).toEqual([]);
      });
    });

    describe('addAktToFavoriteAsync - error paths', () => {
      it('should handle rejected state with default error message', async () => {
        mockWebRTCService.addAktToFavorite.mockResolvedValue({ statusCode: 500 });
        
        const store = createTestStore();
        await store.dispatch(addAktToFavoriteAsync(1) as any);
        
        const state = store.getState().akten;
        expect(state.addToFavoriteLoading).toBe(false);
        expect(state.error).toBe('Failed to add Akt to favorites');
      });

      it('should return aktId on successful add', async () => {
        mockWebRTCService.addAktToFavorite.mockResolvedValue({ statusCode: 200 });
        
        const store = createTestStore();
        const result = await store.dispatch(addAktToFavoriteAsync(42) as any);
        
        expect(result.payload).toBe(42);
      });
    });

    describe('removeAktFromFavoriteAsync - error paths', () => {
      it('should handle rejected state with default error message', async () => {
        mockWebRTCService.removeAktFromFavorite.mockResolvedValue({ statusCode: 500 });
        
        const store = createTestStore();
        await store.dispatch(removeAktFromFavoriteAsync(1) as any);
        
        const state = store.getState().akten;
        expect(state.removeFromFavoriteLoading).toBe(false);
        expect(state.error).toBe('Failed to remove Akt from favorites');
      });

      it('should return aktId on successful removal', async () => {
        mockWebRTCService.removeAktFromFavorite.mockResolvedValue({ statusCode: 200 });
        
        const store = createTestStore();
        const result = await store.dispatch(removeAktFromFavoriteAsync(99) as any);
        
        expect(result.payload).toBe(99);
      });
    });

    describe('getAvailableFoldersAsync - error paths', () => {
      it('should handle rejected state with default error message', async () => {
        mockWebRTCService.getAvailableFolders.mockResolvedValue({ statusCode: 500, body: '[]' });
        
        const store = createTestStore();
        await store.dispatch(getAvailableFoldersAsync(1) as any);
        
        const state = store.getState().akten;
        expect(state.foldersLoading).toBe(false);
        expect(state.foldersError).toBe('Failed to load available folders');
      });

      it('should handle non-array response data', async () => {
        mockWebRTCService.getAvailableFolders.mockResolvedValue({ 
          statusCode: 200, 
          body: '{"invalid": "structure"}' 
        });
        
        const store = createTestStore();
        await store.dispatch(getAvailableFoldersAsync(1) as any);
        
        const state = store.getState().akten;
        expect(state.folderOptions).toEqual([]);
      });

      it('should map folder strings correctly', async () => {
        mockWebRTCService.getAvailableFolders.mockResolvedValue({ 
          statusCode: 200, 
          body: '["Email", "Documents", "Archive"]' 
        });
        
        const store = createTestStore();
        await store.dispatch(getAvailableFoldersAsync(1) as any);
        
        const state = store.getState().akten;
        expect(state.folderOptions).toHaveLength(3);
        expect(state.folderOptions[0]).toEqual({ id: 1, text: 'Email' });
        expect(state.folderOptions[1]).toEqual({ id: 2, text: 'Documents' });
        expect(state.folderOptions[2]).toEqual({ id: 3, text: 'Archive' });
      });
    });

    describe('getCaseDocumentsAsync - cache paths', () => {
      it('should return cached documents when available', async () => {
        const cachedDoc = createMockDocument({ id: 999, betreff: 'Cached' });
        const store = createTestStore({
          akten: {
            ...initialState,
            caseDocumentsCache: [
              createMockCachedAktDocuments({ aktId: 5, documents: [cachedDoc] })
            ]
          }
        });
        
        const result = await store.dispatch(getCaseDocumentsAsync({ aktId: 5 }) as any);
        
        expect(result.payload.fromCache).toBe(true);
        expect(result.payload.documents).toEqual([cachedDoc]);
        // Verify API was NOT called
        expect(mockWebRTCService.GetDocuments).not.toHaveBeenCalled();
      });

      it('should fetch from API when not in cache', async () => {
        mockWebRTCService.GetDocuments.mockResolvedValue({ 
          statusCode: 200, 
          body: JSON.stringify([createMockDocument({ id: 1 })]) 
        });
        
        const store = createTestStore();
        const result = await store.dispatch(getCaseDocumentsAsync({ aktId: 10 }) as any);
        
        expect(result.payload.fromCache).toBe(false);
        expect(mockWebRTCService.GetDocuments).toHaveBeenCalledWith({ aktId: 10 });
      });
    });

    describe('selectEmailDocumentsForAktAndEmail - conditional paths', () => {
      it('should return documents when aktId and emailId match', () => {
        const doc1 = createMockDocument({ id: 1 });
        const state = {
          akten: {
            ...initialState,
            emailDocuments: [doc1],
            emailDocumentsLoadedForAktId: 5,
            emailDocumentsLoadedForEmailId: 'email123'
          }
        };
        
        const result = selectEmailDocumentsForAktAndEmail(state, 5, 'email123');
        expect(result).toEqual([doc1]);
      });

      it('should return documents when aktId matches and no emailId provided', () => {
        const doc1 = createMockDocument({ id: 1 });
        const state = {
          akten: {
            ...initialState,
            emailDocuments: [doc1],
            emailDocumentsLoadedForAktId: 5,
            emailDocumentsLoadedForEmailId: null
          }
        };
        
        const result = selectEmailDocumentsForAktAndEmail(state, 5);
        expect(result).toEqual([doc1]);
      });

      it('should return empty array when aktId does not match', () => {
        const doc1 = createMockDocument({ id: 1 });
        const state = {
          akten: {
            ...initialState,
            emailDocuments: [doc1],
            emailDocumentsLoadedForAktId: 5,
            emailDocumentsLoadedForEmailId: 'email123'
          }
        };
        
        const result = selectEmailDocumentsForAktAndEmail(state, 999, 'email123');
        expect(result).toEqual([]);
      });

      it('should return empty array when emailId does not match', () => {
        const doc1 = createMockDocument({ id: 1 });
        const state = {
          akten: {
            ...initialState,
            emailDocuments: [doc1],
            emailDocumentsLoadedForAktId: 5,
            emailDocumentsLoadedForEmailId: 'email123'
          }
        };
        
        const result = selectEmailDocumentsForAktAndEmail(state, 5, 'differentEmail');
        expect(result).toEqual([]);
      });
    });
  });

  describe('downloadDocumentAsync', () => {
    describe('Successful Download', () => {
      it('should download document and return base64 content', async () => {
        const mockBase64Content = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
        mockWebRTCService.downloadDocument.mockResolvedValue(mockBase64Content);
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/fulfilled');
        if (downloadDocumentAsync.fulfilled.match(result)) {
          expect(result.payload).toBe(mockBase64Content);
        }
      });

      it('should call downloadDocument with correct dokumentId', async () => {
        const dokumentId = 456;
        mockWebRTCService.downloadDocument.mockResolvedValue('base64content');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        await downloadDocumentAsync(dokumentId)(dispatch, getState, undefined);
        
        expect(mockWebRTCService.downloadDocument).toHaveBeenCalledWith(dokumentId);
      });

      it('should handle large base64 content', async () => {
        const largeBase64 = 'A'.repeat(1000000); // 1MB of base64 data
        mockWebRTCService.downloadDocument.mockResolvedValue(largeBase64);
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(789)(dispatch, getState, undefined);
        
        if (downloadDocumentAsync.fulfilled.match(result)) {
          expect(result.payload).toBe(largeBase64);
          expect(result.payload.length).toBe(1000000);
        }
      });

      it('should handle PDF document content', async () => {
        // Typical PDF base64 prefix
        const pdfBase64 = 'JVBERi0xLjQKJeLjz9MK...'; 
        mockWebRTCService.downloadDocument.mockResolvedValue(pdfBase64);
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(100)(dispatch, getState, undefined);
        
        if (downloadDocumentAsync.fulfilled.match(result)) {
          expect(result.payload).toBe(pdfBase64);
        }
      });

      it('should handle image document content', async () => {
        // Typical image base64 prefix
        const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAA...';
        mockWebRTCService.downloadDocument.mockResolvedValue(imageBase64);
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(200)(dispatch, getState, undefined);
        
        if (downloadDocumentAsync.fulfilled.match(result)) {
          expect(result.payload).toBe(imageBase64);
        }
      });
    });

    describe('Error Handling', () => {
      it('should reject when document content is empty string', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue('');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Document content is empty');
        }
      });

      it('should reject when document content is null', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue(null);
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Document content is empty');
        }
      });

      it('should reject when document content is undefined', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue(undefined);
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Document content is empty');
        }
      });

      it('should handle network timeout errors', async () => {
        mockWebRTCService.downloadDocument.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.downloadDocument.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(456)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });

      it('should handle document not found errors', async () => {
        mockWebRTCService.downloadDocument.mockRejectedValue(new Error('Document not found'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(999)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Document not found');
        }
      });

      it('should handle unauthorized access errors', async () => {
        mockWebRTCService.downloadDocument.mockRejectedValue(new Error('Unauthorized'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(789)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Unauthorized');
        }
      });

      it('should handle server errors', async () => {
        mockWebRTCService.downloadDocument.mockRejectedValue(new Error('Internal server error'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(111)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Internal server error');
        }
      });

      it('should handle generic errors', async () => {
        mockWebRTCService.downloadDocument.mockRejectedValue(new Error('Unknown error occurred'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(222)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
        if (downloadDocumentAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Unknown error occurred');
        }
      });
    });

    describe('Edge Cases', () => {
      it('should handle downloading with dokumentId 0', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue('base64content');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(0)(dispatch, getState, undefined);
        
        expect(mockWebRTCService.downloadDocument).toHaveBeenCalledWith(0);
        if (downloadDocumentAsync.fulfilled.match(result)) {
          expect(result.payload).toBe('base64content');
        }
      });

      it('should handle negative dokumentId', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue('base64content');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(-1)(dispatch, getState, undefined);
        
        expect(mockWebRTCService.downloadDocument).toHaveBeenCalledWith(-1);
      });

      it('should handle very large dokumentId', async () => {
        const largeId = Number.MAX_SAFE_INTEGER;
        mockWebRTCService.downloadDocument.mockResolvedValue('base64content');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(largeId)(dispatch, getState, undefined);
        
        expect(mockWebRTCService.downloadDocument).toHaveBeenCalledWith(largeId);
      });

      it('should handle whitespace-only base64 content as empty', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue('   ');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        // Whitespace is truthy, so it should succeed
        if (downloadDocumentAsync.fulfilled.match(result)) {
          expect(result.payload).toBe('   ');
        }
      });

      it('should handle special characters in base64 content', async () => {
        const specialBase64 = 'ABC+/==';
        mockWebRTCService.downloadDocument.mockResolvedValue(specialBase64);
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        if (downloadDocumentAsync.fulfilled.match(result)) {
          expect(result.payload).toBe(specialBase64);
        }
      });
    });

    describe('Multiple Downloads', () => {
      it('should handle multiple sequential downloads', async () => {
        mockWebRTCService.downloadDocument
          .mockResolvedValueOnce('content1')
          .mockResolvedValueOnce('content2')
          .mockResolvedValueOnce('content3');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result1 = await downloadDocumentAsync(1)(dispatch, getState, undefined);
        const result2 = await downloadDocumentAsync(2)(dispatch, getState, undefined);
        const result3 = await downloadDocumentAsync(3)(dispatch, getState, undefined);
        
        if (downloadDocumentAsync.fulfilled.match(result1)) {
          expect(result1.payload).toBe('content1');
        }
        if (downloadDocumentAsync.fulfilled.match(result2)) {
          expect(result2.payload).toBe('content2');
        }
        if (downloadDocumentAsync.fulfilled.match(result3)) {
          expect(result3.payload).toBe('content3');
        }
      });

      it('should handle download failure followed by success', async () => {
        mockWebRTCService.downloadDocument
          .mockRejectedValueOnce(new Error('First attempt failed'))
          .mockResolvedValueOnce('successContent');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const failedResult = await downloadDocumentAsync(1)(dispatch, getState, undefined);
        expect(failedResult.type).toBe('akten/downloadDocument/rejected');
        
        const successResult = await downloadDocumentAsync(1)(dispatch, getState, undefined);
        expect(successResult.type).toBe('akten/downloadDocument/fulfilled');
        if (downloadDocumentAsync.fulfilled.match(successResult)) {
          expect(successResult.payload).toBe('successContent');
        }
      });

      it('should call downloadDocument method the correct number of times', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue('content');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        await downloadDocumentAsync(1)(dispatch, getState, undefined);
        await downloadDocumentAsync(2)(dispatch, getState, undefined);
        await downloadDocumentAsync(3)(dispatch, getState, undefined);
        
        expect(mockWebRTCService.downloadDocument).toHaveBeenCalledTimes(3);
      });
    });

    describe('Type Safety', () => {
      it('should accept number type for dokumentId parameter', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue('content');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const dokumentId: number = 123;
        const result = await downloadDocumentAsync(dokumentId)(dispatch, getState, undefined);
        
        expect(result.type).toContain('akten/downloadDocument');
      });

      it('should return correct action type on fulfilled', async () => {
        mockWebRTCService.downloadDocument.mockResolvedValue('content');
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/fulfilled');
      });

      it('should return correct action type on rejected', async () => {
        mockWebRTCService.downloadDocument.mockRejectedValue(new Error('Failed'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await downloadDocumentAsync(123)(dispatch, getState, undefined);
        
        expect(result.type).toBe('akten/downloadDocument/rejected');
      });
    });
  });
});
