// src/store/services/baseApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE } from '../../config';
import notify from 'devextreme/ui/notify';

// Create a base API with shared configuration
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ 
    baseUrl: API_BASE,
    // Handle global error responses
    responseHandler: async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        notify(`API Error: ${response.status}`, 'error', 5000);
        return Promise.reject(new Error(`Server returned ${response.status}: ${errorText}`));
      }
      return response.json();
    }
  }),
  // Define tags for cache invalidation
  tagTypes: ['Abbreviation', 'Email'],
  endpoints: () => ({}), // We'll extend this in specific API services
});
