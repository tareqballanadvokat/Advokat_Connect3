// Tests for personSlice
import personReducer, {
  clearPersons,
  setSearchTerm,
  clearError,
  personLookUpAsync,
  getFavoritePersonsAsync,
  addPersonToFavoritesAsync,
  removePersonFromFavoritesAsync
} from '../personSlice';
import { PersonLookUpResponse, PersonResponse } from '../../../taskpane/components/interfaces/IPerson';
import { createMockWebRTCService, setupDefaultWebRTCMocks, cleanupTests } from '../testHelpers';
import { createMockPersonLookUp, createMockPersonResponse } from './testFactories';

// Create mock WebRTC service
const mockWebRTCService = createMockWebRTCService();

// Mock WebRTC connection manager
jest.mock('../../../taskpane/services/WebRTCConnectionManager', () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => mockWebRTCService),
  })),
}));

// Mock console.log to avoid cluttering test output
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('personSlice', () => {
  const initialState = {
    persons: [],
    searchTerm: '',
    previousSearchTerm: null,
    loading: false,
    error: null,
    favorites: [],
    favoritesLoading: false,
    addToFavoriteLoading: false,
    addingToFavoritePersonId: null,
    removeFromFavoriteLoading: false,
    removingFromFavoritePersonId: null
  };

  beforeEach(() => {
    cleanupTests();
    
    // Setup default mock implementations
    setupDefaultWebRTCMocks(mockWebRTCService);
  });

  describe('Reducer', () => {
    it('should return the initial state', () => {
      expect(personReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    describe('clearPersons', () => {
      it('should clear persons and favorites', () => {
        const previousState = {
          ...initialState,
          persons: [createMockPersonLookUp()],
          favorites: [createMockPersonResponse()],
          error: 'Some error'
        };
        const actual = personReducer(previousState, clearPersons());
        expect(actual.persons).toEqual([]);
        expect(actual.favorites).toEqual([]);
        expect(actual.error).toBeNull();
      });

      it('should NOT clear loading states', () => {
        const previousState = {
          ...initialState,
          loading: true,
          favoritesLoading: true,
          persons: [createMockPersonLookUp()]
        };
        const actual = personReducer(previousState, clearPersons());
        expect(actual.loading).toBe(true);
        expect(actual.favoritesLoading).toBe(true);
      });
    });

    describe('setSearchTerm', () => {
      it('should set search term', () => {
        const actual = personReducer(initialState, setSearchTerm('John'));
        expect(actual.searchTerm).toBe('John');
      });

      it('should update existing search term', () => {
        const previousState = { ...initialState, searchTerm: 'Old' };
        const actual = personReducer(previousState, setSearchTerm('New'));
        expect(actual.searchTerm).toBe('New');
      });

      it('should handle whitespace-only search terms', () => {
        const previousState = { ...initialState, searchTerm: 'Valid' };
        const actual = personReducer(previousState, setSearchTerm('   '));
        expect(actual.searchTerm).toBe('   ');
        // Note: UI should trim and prevent empty searches before dispatching
      });
    });

    describe('clearError', () => {
      it('should clear error', () => {
        const previousState = { ...initialState, error: 'Network error' };
        const actual = personReducer(previousState, clearError());
        expect(actual.error).toBeNull();
      });

      it('should not affect other state', () => {
        const previousState = {
          ...initialState,
          error: 'Error',
          persons: [createMockPersonLookUp()],
          searchTerm: 'Test'
        };
        const actual = personReducer(previousState, clearError());
        expect(actual.error).toBeNull();
        expect(actual.persons).toEqual(previousState.persons);
        expect(actual.searchTerm).toBe('Test');
      });
    });
  });

  describe('Async Thunks', () => {
    describe('personLookUpAsync', () => {
      it('should handle pending state', () => {
        const action = {
          type: personLookUpAsync.pending.type,
          meta: { arg: 'Test Search' }
        };
        const actual = personReducer(initialState, action);

        expect(actual.loading).toBe(true);
        expect(actual.error).toBeNull();
        expect(actual.searchTerm).toBe('Test Search');
      });

      it('should handle fulfilled state', () => {
        const payload = [createMockPersonLookUp()];
        const action = { type: personLookUpAsync.fulfilled.type, payload };
        const actual = personReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.persons).toEqual(payload);
      });

      it('should handle rejected state', () => {
        const action = {
          type: personLookUpAsync.rejected.type,
          error: { message: 'Network error' }
        };
        const actual = personReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.error).toBe('Network error');
      });

      it('should handle rejected state with undefined error', () => {
        const action = {
          type: personLookUpAsync.rejected.type,
          error: {}
        };
        const actual = personReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.error).toBe('Failed to lookup persons via WebRTC');
      });

      it('should clear error when starting new lookup', () => {
        const previousState = { ...initialState, error: 'Previous error' };
        const action = {
          type: personLookUpAsync.pending.type,
          meta: { arg: 'Search' }
        };
        const actual = personReducer(previousState, action);

        expect(actual.error).toBeNull();
      });

      it('should handle API errors with non-200 status codes (500)', () => {
        const action = {
          type: personLookUpAsync.rejected.type,
          error: { message: 'Failed to lookup persons' }
        };
        const actual = personReducer(initialState, action);

        expect(actual.loading).toBe(false);
        expect(actual.error).toBe('Failed to lookup persons');
      });
    });

    describe('getFavoritePersonsAsync', () => {
      it('should handle pending state', () => {
        const action = { type: getFavoritePersonsAsync.pending.type };
        const actual = personReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(true);
        expect(actual.error).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const payload = [createMockPersonResponse()];
        const action = { type: getFavoritePersonsAsync.fulfilled.type, payload };
        const actual = personReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.favorites).toEqual(payload);
      });

      it('should handle rejected state', () => {
        const action = {
          type: getFavoritePersonsAsync.rejected.type,
          error: { message: 'Network error' }
        };
        const actual = personReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.error).toBe('Network error');
      });

      it('should handle rejected state with undefined error', () => {
        const action = {
          type: getFavoritePersonsAsync.rejected.type,
          error: {}
        };
        const actual = personReducer(initialState, action);

        expect(actual.favoritesLoading).toBe(false);
        expect(actual.error).toBe('Failed to get favorite persons via WebRTC');
      });

      it('should handle multiple persons', () => {
        const payload = [
          createMockPersonResponse({ id: 1 }),
          createMockPersonResponse({ id: 2 }),
          createMockPersonResponse({ id: 3 })
        ];
        const action = { type: getFavoritePersonsAsync.fulfilled.type, payload };
        const actual = personReducer(initialState, action);

        expect(actual.favorites).toHaveLength(3);
        expect(actual.favorites).toEqual(payload);
      });
    });

    describe('addPersonToFavoritesAsync', () => {
      it('should handle pending state', () => {
        const action = {
          type: addPersonToFavoritesAsync.pending.type,
          meta: { arg: 123 }
        };
        const actual = personReducer(initialState, action);

        expect(actual.addToFavoriteLoading).toBe(true);
        expect(actual.addingToFavoritePersonId).toBe(123);
        expect(actual.error).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const previousState = {
          ...initialState,
          addToFavoriteLoading: true,
          addingToFavoritePersonId: 123
        };
        const action = {
          type: addPersonToFavoritesAsync.fulfilled.type,
          payload: 123
        };
        const actual = personReducer(previousState, action);

        expect(actual.addToFavoriteLoading).toBe(false);
        expect(actual.addingToFavoritePersonId).toBeNull();
      });

      it('should handle rejected state', () => {
        const previousState = {
          ...initialState,
          addToFavoriteLoading: true,
          addingToFavoritePersonId: 123
        };
        const action = {
          type: addPersonToFavoritesAsync.rejected.type,
          error: { message: 'Network error' }
        };
        const actual = personReducer(previousState, action);

        expect(actual.addToFavoriteLoading).toBe(false);
        expect(actual.addingToFavoritePersonId).toBeNull();
        expect(actual.error).toBe('Network error');
      });

      it('should handle rejected state with undefined error', () => {
        const action = {
          type: addPersonToFavoritesAsync.rejected.type,
          error: {}
        };
        const actual = personReducer(initialState, action);

        expect(actual.error).toBe('Failed to add person to favorites');
      });
    });

    describe('removePersonFromFavoritesAsync', () => {
      it('should handle pending state', () => {
        const action = {
          type: removePersonFromFavoritesAsync.pending.type,
          meta: { arg: 456 }
        };
        const actual = personReducer(initialState, action);

        expect(actual.removeFromFavoriteLoading).toBe(true);
        expect(actual.removingFromFavoritePersonId).toBe(456);
        expect(actual.error).toBeNull();
      });

      it('should handle fulfilled state', () => {
        const previousState = {
          ...initialState,
          removeFromFavoriteLoading: true,
          removingFromFavoritePersonId: 456
        };
        const action = {
          type: removePersonFromFavoritesAsync.fulfilled.type,
          payload: 456
        };
        const actual = personReducer(previousState, action);

        expect(actual.removeFromFavoriteLoading).toBe(false);
        expect(actual.removingFromFavoritePersonId).toBeNull();
      });

      it('should handle rejected state', () => {
        const previousState = {
          ...initialState,
          removeFromFavoriteLoading: true,
          removingFromFavoritePersonId: 456
        };
        const action = {
          type: removePersonFromFavoritesAsync.rejected.type,
          error: { message: 'Network error' }
        };
        const actual = personReducer(previousState, action);

        expect(actual.removeFromFavoriteLoading).toBe(false);
        expect(actual.removingFromFavoritePersonId).toBeNull();
        expect(actual.error).toBe('Network error');
      });

      it('should handle rejected state with undefined error', () => {
        const action = {
          type: removePersonFromFavoritesAsync.rejected.type,
          error: {}
        };
        const actual = personReducer(initialState, action);

        expect(actual.error).toBe('Failed to remove person from favorites');
      });
    });
  });

  describe('State Transitions', () => {
    it('should handle complete lookup workflow', () => {
      // Start with initial state
      let state = initialState;

      // Pending
      state = personReducer(state, {
        type: personLookUpAsync.pending.type,
        meta: { arg: 'John' }
      });
      expect(state.loading).toBe(true);
      expect(state.searchTerm).toBe('John');

      // Fulfilled
      const persons = [createMockPersonLookUp()];
      state = personReducer(state, {
        type: personLookUpAsync.fulfilled.type,
        payload: persons
      });
      expect(state.loading).toBe(false);
      expect(state.persons).toEqual(persons);
    });

    it('should handle favorites workflow with add and remove', () => {
      let state = initialState;

      // Load favorites
      const favorites = [createMockPersonResponse({ id: 1 })];
      state = personReducer(state, {
        type: getFavoritePersonsAsync.fulfilled.type,
        payload: favorites
      });
      expect(state.favorites).toHaveLength(1);

      // Add to favorites - pending
      state = personReducer(state, {
        type: addPersonToFavoritesAsync.pending.type,
        meta: { arg: 2 }
      });
      expect(state.addingToFavoritePersonId).toBe(2);

      // Add to favorites - fulfilled
      state = personReducer(state, {
        type: addPersonToFavoritesAsync.fulfilled.type,
        payload: 2
      });
      expect(state.addingToFavoritePersonId).toBeNull();

      // Remove from favorites - pending
      state = personReducer(state, {
        type: removePersonFromFavoritesAsync.pending.type,
        meta: { arg: 1 }
      });
      expect(state.removingFromFavoritePersonId).toBe(1);

      // Remove from favorites - fulfilled
      state = personReducer(state, {
        type: removePersonFromFavoritesAsync.fulfilled.type,
        payload: 1
      });
      expect(state.removingFromFavoritePersonId).toBeNull();
    });

    it('should handle error recovery', () => {
      let state = { ...initialState, error: 'Previous error' };

      // New lookup should clear error
      state = personReducer(state, {
        type: personLookUpAsync.pending.type,
        meta: { arg: 'Search' }
      });
      expect(state.error).toBeNull();

      // Error occurs
      state = personReducer(state, {
        type: personLookUpAsync.rejected.type,
        error: { message: 'Network error' }
      });
      expect(state.error).toBe('Network error');

      // Clear error manually
      state = personReducer(state, clearError());
      expect(state.error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search results', () => {
      const action = {
        type: personLookUpAsync.fulfilled.type,
        payload: []
      };
      const actual = personReducer(initialState, action);

      expect(actual.persons).toEqual([]);
      expect(actual.loading).toBe(false);
    });

    it('should handle empty favorites', () => {
      const action = {
        type: getFavoritePersonsAsync.fulfilled.type,
        payload: []
      };
      const actual = personReducer(initialState, action);

      expect(actual.favorites).toEqual([]);
      expect(actual.favoritesLoading).toBe(false);
    });

    it('should handle multiple pending operations simultaneously', () => {
      let state = initialState;

      // Start lookup
      state = personReducer(state, {
        type: personLookUpAsync.pending.type,
        meta: { arg: 'Search' }
      });

      // Start loading favorites
      state = personReducer(state, {
        type: getFavoritePersonsAsync.pending.type
      });

      // Start adding to favorites
      state = personReducer(state, {
        type: addPersonToFavoritesAsync.pending.type,
        meta: { arg: 1 }
      });

      expect(state.loading).toBe(true);
      expect(state.favoritesLoading).toBe(true);
      expect(state.addToFavoriteLoading).toBe(true);
      expect(state.addingToFavoritePersonId).toBe(1);
    });

    it('should handle very large person lists', () => {
      const largePersonList = Array.from({ length: 1000 }, (_, i) => 
        createMockPersonLookUp({ id: i + 1 })
      );

      const action = {
        type: personLookUpAsync.fulfilled.type,
        payload: largePersonList
      };
      const actual = personReducer(initialState, action);

      expect(actual.persons).toHaveLength(1000);
      expect(actual.persons[0].id).toBe(1);
      expect(actual.persons[999].id).toBe(1000);
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state when setting search term', () => {
      const originalState = { ...initialState };
      const stateCopy = { ...initialState };

      personReducer(stateCopy, setSearchTerm('Test'));

      expect(initialState).toEqual(originalState);
    });

    it('should not mutate original state when clearing persons', () => {
      const originalState = {
        ...initialState,
        persons: [createMockPersonLookUp()],
        favorites: [createMockPersonResponse()]
      };
      const originalPersons = originalState.persons;
      const originalFavorites = originalState.favorites;

      const newState = personReducer(originalState, clearPersons());

      expect(newState.persons).not.toBe(originalPersons);
      expect(newState.favorites).not.toBe(originalFavorites);
      expect(originalPersons).toHaveLength(1); // Original unchanged
      expect(originalFavorites).toHaveLength(1); // Original unchanged
    });

    it('should return new object references for modified properties', () => {
      const originalState = { ...initialState };
      const newState = personReducer(originalState, setSearchTerm('New'));

      expect(newState).not.toBe(originalState);
      expect(newState.searchTerm).not.toBe(originalState.searchTerm);
    });

    it('should not mutate persons array when updating', () => {
      const originalPersons = [createMockPersonLookUp()];
      const previousState = { ...initialState, persons: originalPersons };

      const newPersons = [createMockPersonLookUp({ id: 2 })];
      const newState = personReducer(previousState, {
        type: personLookUpAsync.fulfilled.type,
        payload: newPersons
      });

      expect(newState.persons).not.toBe(originalPersons);
      expect(originalPersons).toHaveLength(1);
      expect(originalPersons[0].id).toBe(1);
    });
  });

  describe('Error Clearing Behavior', () => {
    it('should clear error when starting new lookup', () => {
      const previousState = { ...initialState, error: 'Previous error' };
      const action = {
        type: personLookUpAsync.pending.type,
        meta: { arg: 'Search' }
      };
      const actual = personReducer(previousState, action);

      expect(actual.error).toBeNull();
    });

    it('should clear error when starting to load favorites', () => {
      const previousState = { ...initialState, error: 'Previous error' };
      const action = { type: getFavoritePersonsAsync.pending.type };
      const actual = personReducer(previousState, action);

      expect(actual.error).toBeNull();
    });

    it('should clear error when adding to favorites', () => {
      const previousState = { ...initialState, error: 'Previous error' };
      const action = {
        type: addPersonToFavoritesAsync.pending.type,
        meta: { arg: 1 }
      };
      const actual = personReducer(previousState, action);

      expect(actual.error).toBeNull();
    });

    it('should clear error when removing from favorites', () => {
      const previousState = { ...initialState, error: 'Previous error' };
      const action = {
        type: removePersonFromFavoritesAsync.pending.type,
        meta: { arg: 1 }
      };
      const actual = personReducer(previousState, action);

      expect(actual.error).toBeNull();
    });

    it('should handle manual error clearing', () => {
      const previousState = { ...initialState, error: 'Some error' };
      const actual = personReducer(previousState, clearError());

      expect(actual.error).toBeNull();
    });
  });

  describe('WebRTC Service Error Handling', () => {
    describe('personLookUpAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.personLookUp.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await personLookUpAsync('John')(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/personLookUp/rejected');
        if (personLookUpAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.personLookUp.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await personLookUpAsync('Jane')(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/personLookUp/rejected');
        if (personLookUpAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });

      it('should handle non-200 status code (400 Bad Request)', async () => {
        mockWebRTCService.personLookUp.mockResolvedValue({ 
          statusCode: 400, 
          body: 'Invalid search query' 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await personLookUpAsync('')(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/personLookUp/rejected');
        if (personLookUpAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Failed to lookup persons');
        }
      });

      it('should handle non-200 status code (500 Internal Server Error)', async () => {
        mockWebRTCService.personLookUp.mockResolvedValue({ 
          statusCode: 500, 
          body: 'Database error' 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await personLookUpAsync('Search')(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/personLookUp/rejected');
        if (personLookUpAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Failed to lookup persons');
        }
      });

      it('should handle response with null body', async () => {
        mockWebRTCService.personLookUp.mockResolvedValue({ 
          statusCode: 200, 
          body: null 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await personLookUpAsync('Test')(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/personLookUp/fulfilled');
        if (personLookUpAsync.fulfilled.match(result)) {
          expect(result.payload).toEqual([]);
        }
      });
    });

    describe('getFavoritePersonsAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.getFavoritePersons.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getFavoritePersonsAsync({ NurFavoriten: true, Count: 10 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/getFavoritePersons/rejected');
        if (getFavoritePersonsAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.getFavoritePersons.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getFavoritePersonsAsync({ NurFavoriten: true })(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/getFavoritePersons/rejected');
        if (getFavoritePersonsAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });

      it('should handle non-200 status code (401 Unauthorized)', async () => {
        mockWebRTCService.getFavoritePersons.mockResolvedValue({ 
          statusCode: 401, 
          body: 'Unauthorized' 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getFavoritePersonsAsync({ Count: 10 })(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/getFavoritePersons/rejected');
        if (getFavoritePersonsAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Failed to get favorite persons');
        }
      });

      it('should handle response with null body', async () => {
        mockWebRTCService.getFavoritePersons.mockResolvedValue({ 
          statusCode: 200, 
          body: null 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await getFavoritePersonsAsync({ NurFavoriten: true })(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/getFavoritePersons/fulfilled');
        if (getFavoritePersonsAsync.fulfilled.match(result)) {
          expect(result.payload).toEqual([]);
        }
      });
    });

    describe('addPersonToFavoritesAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.addPersonToFavorites.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await addPersonToFavoritesAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/addToFavorites/rejected');
        if (addPersonToFavoritesAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.addPersonToFavorites.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await addPersonToFavoritesAsync(2)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/addToFavorites/rejected');
        if (addPersonToFavoritesAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });

      it('should handle non-200 status code (409 Already Exists)', async () => {
        mockWebRTCService.addPersonToFavorites.mockResolvedValue({ 
          statusCode: 409, 
          body: 'Person already in favorites' 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await addPersonToFavoritesAsync(3)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/addToFavorites/rejected');
        if (addPersonToFavoritesAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Failed to add person to favorites');
        }
      });

      it('should successfully add person to favorites with 200 status', async () => {
        mockWebRTCService.addPersonToFavorites.mockResolvedValue({ 
          statusCode: 200, 
          body: 'Success' 
        });
        mockWebRTCService.getFavoritePersons.mockResolvedValue({
          statusCode: 200,
          body: JSON.stringify([createMockPersonResponse()])
        });
        
        const dispatch = jest.fn((action) => {
          if (typeof action === 'function') {
            return action(dispatch, jest.fn(), undefined);
          }
          return action;
        });
        const getState = jest.fn();
        
        const result = await addPersonToFavoritesAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/addToFavorites/fulfilled');
        expect(result.payload).toBe(1);
        // Verify that dispatch was called (for the nested getFavoritePersonsAsync)
        expect(dispatch).toHaveBeenCalled();
      });
    });

    describe('removePersonFromFavoritesAsync', () => {
      it('should handle network timeouts', async () => {
        mockWebRTCService.removePersonFromFavorites.mockRejectedValue(new Error('Network timeout'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await removePersonFromFavoritesAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/removeFromFavorites/rejected');
        if (removePersonFromFavoritesAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Network timeout');
        }
      });

      it('should handle connection refused errors', async () => {
        mockWebRTCService.removePersonFromFavorites.mockRejectedValue(new Error('Connection refused'));
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await removePersonFromFavoritesAsync(2)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/removeFromFavorites/rejected');
        if (removePersonFromFavoritesAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Connection refused');
        }
      });

      it('should handle non-200 status code (404 Not Found)', async () => {
        mockWebRTCService.removePersonFromFavorites.mockResolvedValue({ 
          statusCode: 404, 
          body: 'Person not in favorites' 
        });
        
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        const result = await removePersonFromFavoritesAsync(3)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/removeFromFavorites/rejected');
        if (removePersonFromFavoritesAsync.rejected.match(result)) {
          expect(result.error.message).toBe('Failed to remove person from favorites');
        }
      });

      it('should successfully remove person from favorites with 200 status', async () => {
        mockWebRTCService.removePersonFromFavorites.mockResolvedValue({ 
          statusCode: 200, 
          body: 'Success' 
        });
        mockWebRTCService.getFavoritePersons.mockResolvedValue({
          statusCode: 200,
          body: JSON.stringify([])
        });
        
        const dispatch = jest.fn((action) => {
          if (typeof action === 'function') {
            return action(dispatch, jest.fn(), undefined);
          }
          return action;
        });
        const getState = jest.fn();
        
        const result = await removePersonFromFavoritesAsync(1)(dispatch, getState, undefined);
        
        expect(result.type).toBe('person/removeFromFavorites/fulfilled');
        expect(result.payload).toBe(1);
        // Verify that dispatch was called (for the nested getFavoritePersonsAsync)
        expect(dispatch).toHaveBeenCalled();
      });
    });
  });
});

