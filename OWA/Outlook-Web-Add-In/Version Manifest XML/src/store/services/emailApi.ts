// src/store/services/emailApi.ts
import { baseApi } from './baseApi';
import { EmailModel } from '@components/interfaces/IEmail';

// Extending the base API with email-specific endpoints
export const emailApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get saved email info by messageId
    getSavedEmail: builder.query<EmailModel | null, string>({
      query: (messageId) => ({
        url: 'api/email/get',
        method: 'POST',
        body: { id: messageId }
      }),
      transformResponse: (response: any) => {
        if (response === null) return null;
        
        // Transform response to match our existing interface
        return {
          caseId: response.caseId ?? response.caseId,
          caseName: response.caseName ?? response.caseName,
          serviceAbbreviationType: response.serviceAbbreviationType ?? response.serviceAbbreviationType,
          serviceSB: response.serviceSB ?? response.serviceSB,
          serviceTime: response.serviceTime ?? response.serviceTime,
          serviceText: response.serviceText ?? response.serviceText,
          internetMessageId: response.internetMessageId ?? response.internetMessageId,
          emailName: response.emailName ?? response.emailName,
          emailContent: response.emailContent ?? response.emailContent,
          emailFolder: response.emailFolder ?? response.emailFolder,
          emailFolderId: response.emailFolderId ?? response.emailFolderId,
          userID: response.userID ?? response.userID,
          attachments: Array.isArray(response.attachments ?? response.attachments)
            ? ((response.attachments ?? response.attachments) as any[]).map(att => ({
                id: att.id ?? att.id,
                originalFileName: att.OriginalFileName ?? att.originalFileName,
                fileName: att.fileName ?? att.fileName,
                contentBase64: att.contentBase64 ?? att.contentBase64,
                folder: att.folder ?? att.folder
              }))
            : []
        };
      },
      providesTags: ['Email'],
    }),
    
    // Save email information
    saveEmailInfo: builder.mutation<any, EmailModel>({
      query: (payload) => ({
        url: 'api/email/add-to-advocat',
        method: 'POST',
        body: payload
      }),
      invalidatesTags: ['Email'],
    }),
  }),
});

// Export auto-generated hooks for the endpoints
export const { 
  useGetSavedEmailQuery,
  useSaveEmailInfoMutation
} = emailApi;
