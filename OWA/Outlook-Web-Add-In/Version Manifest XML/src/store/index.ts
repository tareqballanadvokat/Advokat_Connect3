// src/store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import emailReducer from "./slices/emailSlice";
import serviceReducer from "./slices/serviceSlice";
import aktenReducer from "./slices/aktenSlice";
import personReducer from "./slices/personSlice";
import authReducer from "./slices/authSlice";
import connectionReducer from "./slices/connectionSlice";
import loggingReducer from "./slices/loggingSlice";

// Configure the Redux store
export const store = configureStore({
  reducer: {
    email: emailReducer,
    service: serviceReducer,
    akten: aktenReducer,
    person: personReducer,
    auth: authReducer,
    connection: connectionReducer,
    logging: loggingReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
