/**
 * Unit Tests for emailSlice
 * Tests all reducers, async thunks, and state transitions
 */

import emailReducer, {
  setAttachmentSelected,
  clearSaveDokumentError,
  saveDokumentAsync,
} from '../emailSlice';
import { TransferAttachmentItem, DokumentPostData } from '../../../taskpane/components/interfaces/IDocument';
import { createMockWebRTCService, setupDefaultWebRTCMocks, cleanupTests } from '../testHelpers';
import { createMockAttachment, createMockDokumentPostData } from './testFactories';

// Create mock WebRTC service
const mockWebRTCService = createMockWebRTCService();

// Mock WebRTC connection manager
jest.mock('../../../taskpane/services/WebRTCConnectionManager', () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => mockWebRTCService),
  })),
}));

describe('emailSlice', () => {
  beforeEach(() => {
    cleanupTests();
    
    // Setup default mock implementations
    setupDefaultWebRTCMocks(mockWebRTCService);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Initial state for tests
  const initialState = {
    attachmentSelected: [],
    saveDokumentLoading: false,
    saveDokumentError: null,
  };

  // Mock data
  const mockAttachment = createMockAttachment();

  describe('Reducer', () => {
    it('should return the initial state', () => {
      expect(emailReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    describe('setAttachmentSelected', () => {
      it('should set selected attachments', () => {
        const attachments = [mockAttachment];
        const actual = emailReducer(initialState, setAttachmentSelected(attachments));

        expect(actual.attachmentSelected).toEqual(attachments);
        expect(actual.attachmentSelected).toHaveLength(1);
      });

      it('should replace existing attachments', () => {
        const stateWithAttachments = {
          ...initialState,
          attachmentSelected: [mockAttachment],
        };

        const newAttachments = [
          createMockAttachment({ id: 'attachment-2', name: 'new.pdf' }),
        ];

        const actual = emailReducer(stateWithAttachments, setAttachmentSelected(newAttachments));

        expect(actual.attachmentSelected).toEqual(newAttachments);
        expect(actual.attachmentSelected).toHaveLength(1);
        expect(actual.attachmentSelected[0].id).toBe('attachment-2');
      });

      it('should handle empty array', () => {
        const stateWithAttachments = {
          ...initialState,
          attachmentSelected: [mockAttachment],
        };

        const actual = emailReducer(stateWithAttachments, setAttachmentSelected([]));

        expect(actual.attachmentSelected).toEqual([]);
      });

      it('should handle multiple attachments', () => {
        const attachments = [
          createMockAttachment({ id: 'attachment-1' }),
          createMockAttachment({ id: 'attachment-2' }),
          createMockAttachment({ id: 'attachment-3' }),
        ];

        const actual = emailReducer(initialState, setAttachmentSelected(attachments));

        expect(actual.attachmentSelected).toHaveLength(3);
        expect(actual.attachmentSelected[0].id).toBe('attachment-1');
        expect(actual.attachmentSelected[2].id).toBe('attachment-3');
      });
    });

    describe('clearSaveDokumentError', () => {
      it('should clear error', () => {
        const stateWithError = {
          ...initialState,
          saveDokumentError: 'Some error',
        };

        const actual = emailReducer(stateWithError, clearSaveDokumentError());

        expect(actual.saveDokumentError).toBeNull();
      });

      it('should not affect other state', () => {
        const stateWithError = {
          ...initialState,
          attachmentSelected: [mockAttachment],
          saveDokumentLoading: true,
          saveDokumentError: 'Some error',
        };

        const actual = emailReducer(stateWithError, clearSaveDokumentError());

        expect(actual.saveDokumentError).toBeNull();
        expect(actual.attachmentSelected).toEqual([mockAttachment]);
        expect(actual.saveDokumentLoading).toBe(true);
      });
    });
  });

  describe('Async Thunks', () => {
    describe('saveDokumentAsync', () => {
      it('should handle pending state', () => {
        const action = { type: saveDokumentAsync.pending.type };
        const actual = emailReducer(initialState, action);

        expect(actual.saveDokumentLoading).toBe(true);
        expect(actual.saveDokumentError).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const action = { type: saveDokumentAsync.fulfilled.type };
        const actual = emailReducer(initialState, action);

        expect(actual.saveDokumentLoading).toBe(false);
        expect(actual.saveDokumentError).toBeNull();
      });

      it('should handle rejected state', () => {
        const action = {
          type: saveDokumentAsync.rejected.type,
          error: { message: 'Save failed' },
        };
        const actual = emailReducer(initialState, action);

        expect(actual.saveDokumentLoading).toBe(false);
        expect(actual.saveDokumentError).toBe('Save failed');
      });

      it('should handle rejected state with undefined error', () => {
        const action = {
          type: saveDokumentAsync.rejected.type,
          error: {},
        };
        const actual = emailReducer(initialState, action);

        expect(actual.saveDokumentLoading).toBe(false);
        expect(actual.saveDokumentError).toBe('Failed to save document');
      });

      it('should clear error when starting new save', () => {
        const stateWithError = {
          ...initialState,
          saveDokumentError: 'Previous error',
        };

        const action = { type: saveDokumentAsync.pending.type };
        const actual = emailReducer(stateWithError, action);

        expect(actual.saveDokumentError).toBeNull();
        expect(actual.saveDokumentLoading).toBe(true);
      });

      it('should handle API errors with non-200 status codes (500)', () => {
        const action = {
          type: saveDokumentAsync.rejected.type,
          error: { message: 'Internal Server Error: 500' },
        };
        const actual = emailReducer(initialState, action);

        expect(actual.saveDokumentLoading).toBe(false);
        expect(actual.saveDokumentError).toBe('Internal Server Error: 500');
      });

      it('should handle API errors with non-200 status codes (400)', () => {
        const action = {
          type: saveDokumentAsync.rejected.type,
          error: { message: 'Bad Request: 400' },
        };
        const actual = emailReducer(initialState, action);

        expect(actual.saveDokumentLoading).toBe(false);
        expect(actual.saveDokumentError).toBe('Bad Request: 400');
      });

      it('should handle API errors with non-200 status codes (403)', () => {
        const action = {
          type: saveDokumentAsync.rejected.type,
          error: { message: 'Forbidden: 403' },
        };
        const actual = emailReducer(initialState, action);

        expect(actual.saveDokumentLoading).toBe(false);
        expect(actual.saveDokumentError).toBe('Forbidden: 403');
      });
    });
  });

  describe('State Transitions', () => {
    it('should handle complete save document workflow', () => {
      let state = initialState;

      // Select attachments
      state = emailReducer(state, setAttachmentSelected([mockAttachment]));
      expect(state.attachmentSelected).toHaveLength(1);

      // Start save
      state = emailReducer(state, { type: saveDokumentAsync.pending.type });
      expect(state.saveDokumentLoading).toBe(true);
      expect(state.saveDokumentError).toBeNull();

      // Complete save
      state = emailReducer(state, { type: saveDokumentAsync.fulfilled.type });
      expect(state.saveDokumentLoading).toBe(false);
      expect(state.saveDokumentError).toBeNull();
    });

    it('should handle save document with error recovery', () => {
      let state = initialState;

      // First save fails
      state = emailReducer(state, {
        type: saveDokumentAsync.rejected.type,
        error: { message: 'Network error' },
      });
      expect(state.saveDokumentError).toBe('Network error');

      // Retry clears error
      state = emailReducer(state, { type: saveDokumentAsync.pending.type });
      expect(state.saveDokumentError).toBeNull();

      // Success
      state = emailReducer(state, { type: saveDokumentAsync.fulfilled.type });
      expect(state.saveDokumentLoading).toBe(false);
      expect(state.saveDokumentError).toBeNull();
    });

    it('should handle clearing attachments after save', () => {
      let state = {
        ...initialState,
        attachmentSelected: [mockAttachment],
      };

      // Save document
      state = emailReducer(state, { type: saveDokumentAsync.fulfilled.type });

      // Clear attachments
      state = emailReducer(state, setAttachmentSelected([]));
      expect(state.attachmentSelected).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting attachments with same IDs', () => {
      const duplicateAttachments = [
        createMockAttachment({ id: 'same-id' }),
        createMockAttachment({ id: 'same-id' }),
      ];

      const actual = emailReducer(initialState, setAttachmentSelected(duplicateAttachments));

      expect(actual.attachmentSelected).toHaveLength(2);
      expect(actual.attachmentSelected[0].id).toBe('same-id');
      expect(actual.attachmentSelected[1].id).toBe('same-id');
    });

    it('should preserve attachments during save operations', () => {
      const stateWithAttachments = {
        ...initialState,
        attachmentSelected: [mockAttachment],
      };

      const actual = emailReducer(stateWithAttachments, { type: saveDokumentAsync.pending.type });

      expect(actual.attachmentSelected).toEqual([mockAttachment]);
      expect(actual.saveDokumentLoading).toBe(true);
    });

    it('should handle clearing error when no error exists', () => {
      const actual = emailReducer(initialState, clearSaveDokumentError());

      expect(actual.saveDokumentError).toBeNull();
    });

    it('should handle multiple error clears', () => {
      let state = {
        ...initialState,
        saveDokumentError: 'Error',
      };

      state = emailReducer(state, clearSaveDokumentError());
      state = emailReducer(state, clearSaveDokumentError());
      state = emailReducer(state, clearSaveDokumentError());

      expect(state.saveDokumentError).toBeNull();
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state when setting attachments', () => {
      const originalState = { ...initialState };
      const newAttachments = [mockAttachment];
      const newState = emailReducer(originalState, setAttachmentSelected(newAttachments));

      expect(originalState.attachmentSelected).toHaveLength(0); // Unchanged
      expect(newState.attachmentSelected).toHaveLength(1);
    });

    it('should return new object references for modified properties', () => {
      const originalState = initialState;
      const newAttachments = [mockAttachment];
      const newState = emailReducer(originalState, setAttachmentSelected(newAttachments));

      expect(newState).not.toBe(originalState);
      expect(newState.attachmentSelected).not.toBe(originalState.attachmentSelected);
    });

    it('should not mutate attachment array when creating new state', () => {
      const originalAttachments = [createMockAttachment()];
      const state = emailReducer(initialState, setAttachmentSelected(originalAttachments));

      // Create new state with different attachments
      const newAttachments = [createMockAttachment({ id: 'different-id' })];
      const newState = emailReducer(state, setAttachmentSelected(newAttachments));

      // Original state's attachments should be unchanged
      expect(state.attachmentSelected[0].id).toBe('attachment-1');
      expect(newState.attachmentSelected[0].id).toBe('different-id');
    });

    it('should preserve unmodified state during error clearing', () => {
      const originalState = {
        ...initialState,
        attachmentSelected: [mockAttachment],
        saveDokumentLoading: true,
        saveDokumentError: 'Error',
      };

      const newState = emailReducer(originalState, clearSaveDokumentError());

      expect(newState.attachmentSelected).toBe(originalState.attachmentSelected); // Same reference
      expect(newState.saveDokumentLoading).toBe(true);
      expect(newState.saveDokumentError).toBeNull(); // Changed
    });
  });

  describe('Error Clearing Behavior', () => {
    it('should clear error when starting save operation', () => {
      const stateWithError = {
        ...initialState,
        saveDokumentError: 'Previous error',
      };

      const actual = emailReducer(stateWithError, { type: saveDokumentAsync.pending.type });

      expect(actual.saveDokumentError).toBeNull();
    });

    it('should clear error on successful save', () => {
      const stateWithError = {
        ...initialState,
        saveDokumentError: 'Previous error',
      };

      const actual = emailReducer(stateWithError, { type: saveDokumentAsync.fulfilled.type });

      expect(actual.saveDokumentError).toBeNull();
    });

    it('should handle manual error clearing', () => {
      const stateWithError = {
        ...initialState,
        saveDokumentError: 'Error to clear',
      };

      const actual = emailReducer(stateWithError, clearSaveDokumentError());

      expect(actual.saveDokumentError).toBeNull();
    });
  });

  describe('Attachment Management', () => {
    it('should handle checked and unchecked attachments', () => {
      const attachments = [
        createMockAttachment({ id: 'att-1', checked: true }),
        createMockAttachment({ id: 'att-2', checked: false }),
      ];

      const actual = emailReducer(initialState, setAttachmentSelected(attachments));

      expect(actual.attachmentSelected[0].checked).toBe(true);
      expect(actual.attachmentSelected[1].checked).toBe(false);
    });

    it('should handle attachments with different types', () => {
      const attachments = [
        createMockAttachment({ id: 'email-1', type: 'E', name: 'Email' }),
        createMockAttachment({ id: 'attach-1', type: 'A', name: 'Attachment' }),
      ];

      const actual = emailReducer(initialState, setAttachmentSelected(attachments));

      expect(actual.attachmentSelected[0].type).toBe('E');
      expect(actual.attachmentSelected[1].type).toBe('A');
    });

    it('should handle disabled and readonly attachments', () => {
      const attachments = [
        createMockAttachment({ id: 'att-1', disabled: true }),
        createMockAttachment({ id: 'att-2', readonly: true }),
      ];

      const actual = emailReducer(initialState, setAttachmentSelected(attachments));

      expect(actual.attachmentSelected[0].disabled).toBe(true);
      expect(actual.attachmentSelected[1].readonly).toBe(true);
    });

    it('should handle attachments with folder information', () => {
      const attachments = [
        createMockAttachment({ 
          id: 'att-1', 
          option: 1, 
          folderName: 'Email' 
        }),
        createMockAttachment({ 
          id: 'att-2', 
          option: 2, 
          folderName: 'Contracts' 
        }),
      ];

      const actual = emailReducer(initialState, setAttachmentSelected(attachments));

      expect(actual.attachmentSelected[0].folderName).toBe('Email');
      expect(actual.attachmentSelected[1].option).toBe(2);
    });
  });

  describe('WebRTC Service Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockWebRTCService.saveDokument.mockRejectedValue(new Error('Network timeout'));
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      const mockDokumentData = createMockDokumentPostData();
      
      const result = await saveDokumentAsync(mockDokumentData)(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/rejected');
      if (saveDokumentAsync.rejected.match(result)) {
        expect(result.error.message).toBe('Network timeout');
      }
    });

    it('should handle connection refused errors', async () => {
      mockWebRTCService.saveDokument.mockRejectedValue(new Error('Connection refused'));
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      const result = await saveDokumentAsync(createMockDokumentPostData())(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/rejected');
      if (saveDokumentAsync.rejected.match(result)) {
        expect(result.error.message).toBe('Connection refused');
      }
    });

    it('should handle non-200 status code (400 Bad Request)', async () => {
      mockWebRTCService.saveDokument.mockResolvedValue({ 
        statusCode: 400, 
        body: 'Invalid document data' 
      });
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      const result = await saveDokumentAsync(createMockDokumentPostData())(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/rejected');
      if (saveDokumentAsync.rejected.match(result)) {
        expect(result.error.message).toContain('Invalid document data');
      }
    });

    it('should handle non-200 status code (401 Unauthorized)', async () => {
      mockWebRTCService.saveDokument.mockResolvedValue({ 
        statusCode: 401, 
        body: 'Unauthorized access' 
      });
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      const result = await saveDokumentAsync(createMockDokumentPostData())(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/rejected');
      if (saveDokumentAsync.rejected.match(result)) {
        expect(result.error.message).toContain('Unauthorized access');
      }
    });

    it('should handle non-200 status code (500 Internal Server Error)', async () => {
      mockWebRTCService.saveDokument.mockResolvedValue({ 
        statusCode: 500, 
        body: 'Database error' 
      });
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      const result = await saveDokumentAsync(createMockDokumentPostData())(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/rejected');
      if (saveDokumentAsync.rejected.match(result)) {
        expect(result.error.message).toContain('Database error');
      }
    });

    it('should handle non-200 status code (503 Service Unavailable)', async () => {
      mockWebRTCService.saveDokument.mockResolvedValue({ 
        statusCode: 503, 
        body: 'Service temporarily unavailable' 
      });
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      const result = await saveDokumentAsync(createMockDokumentPostData())(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/rejected');
      if (saveDokumentAsync.rejected.match(result)) {
        expect(result.error.message).toContain('Service temporarily unavailable');
      }
    });

    it('should handle response with null body', async () => {
      mockWebRTCService.saveDokument.mockResolvedValue({ 
        statusCode: 400, 
        body: null 
      });
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      const result = await saveDokumentAsync(createMockDokumentPostData())(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/rejected');
      if (saveDokumentAsync.rejected.match(result)) {
        expect(result.error.message).toBe('Failed to save document');
      }
    });

    it('should successfully save document with 200 status', async () => {
      mockWebRTCService.saveDokument.mockResolvedValue({ 
        statusCode: 200, 
        body: 'Document saved successfully' 
      });
      
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      const result = await saveDokumentAsync(createMockDokumentPostData())(dispatch, getState, undefined);
      
      expect(result.type).toBe('email/saveDokument/fulfilled');
      if (saveDokumentAsync.fulfilled.match(result)) {
        expect(result.payload.statusCode).toBe(200);
      }
    });
  });

  describe('Scalability', () => {
    it('should handle large attachment lists', () => {
      const largeList = Array.from({ length: 100 }, (_, i) => 
        createMockAttachment({ id: `att-${i}` })
      );

      const actual = emailReducer(initialState, setAttachmentSelected(largeList));

      expect(actual.attachmentSelected).toHaveLength(100);
      expect(actual.attachmentSelected[0].id).toBe('att-0');
      expect(actual.attachmentSelected[99].id).toBe('att-99');
    });
  });
});
