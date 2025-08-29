// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import emailReducer from './slices/emailSlice';
import serviceReducer from './slices/serviceSlice';
import aktenReducer from './slices/aktenSlice';
import personReducer from './slices/personSlice';

// Configure the Redux store
export const store = configureStore({
  reducer: {
    email: emailReducer,
    service: serviceReducer,
    akten: aktenReducer,
    person: personReducer,
    // Add other reducers here as your application grows
  },
  // Use default middleware since we no longer need RTK Query
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
