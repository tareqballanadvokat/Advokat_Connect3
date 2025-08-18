// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './services/baseApi';
import emailReducer from './slices/emailSlice';
import serviceReducer from './slices/serviceSlice';
import aktenReducer from './slices/aktenSlice';
import personReducer from './slices/personSlice';

// Configure the Redux store
export const store = configureStore({
  reducer: {
    // Add the generated reducer as a specific top-level slice
    [baseApi.reducerPath]: baseApi.reducer,
    email: emailReducer,
    service: serviceReducer,
    akten: aktenReducer,
    person: personReducer,
    // Add other reducers here as your application grows
  },
  // Adding the api middleware enables caching, invalidation, polling,
  // and other useful features of RTK Query
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

// Optional, but required for refetchOnFocus/refetchOnReconnect behaviors
// see `setupListeners` docs - takes an optional callback as the 2nd arg for customization
setupListeners(store.dispatch);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
