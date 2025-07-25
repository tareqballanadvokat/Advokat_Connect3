// src/store/services/abbreviationApi.ts
import { baseApi } from './baseApi';
import { Abbreviation } from '@components/interfaces/ICommon';

// Extending the base API with abbreviation-specific endpoints
export const abbreviationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Define a query endpoint for fetching abbreviations
    getAbbreviations: builder.query<Abbreviation[], void>({
      query: () => 'api/abbreviation/get-abbreviation',
      // Transform response to match our existing interface
      transformResponse: (response: Array<{ id: number; name: string }>) => {
        return response.map(item => ({
          id: item.id,
          name: item.name
        }));
      },
      // Provide a tag for cache invalidation
      providesTags: ['Abbreviation'],
    }),
  }),
});

// Export auto-generated hooks for the endpoints
export const { useGetAbbreviationsQuery } = abbreviationApi;
