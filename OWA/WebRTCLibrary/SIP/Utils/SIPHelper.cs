using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP.Utils
{
    public static class SIPHelper
    {
        public static SIPRequest GetRequest(SIPSchemesEnum sipScheme, SIPMethodsEnum method, SIPHeaderParams headerParams)
        {
            SIPRequest request = SIPRequest.GetRequest(
                method,
                new SIPURI(
                    sipScheme,
                    headerParams.DestinationParticipant.Endpoint));

            PopulateHeader(request, sipScheme, headerParams);
            return request;
        }

        public static SIPRequest GetRequest(SIPSchemesEnum sipScheme, SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType)
        {
            SIPRequest request = GetRequest(sipScheme, method, headerParams);
            SetBody(request, message, contentType);
            return request;
        }

        public static SIPResponse GetResponse(SIPSchemesEnum sipScheme, SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams)
        {
            SIPResponse response = SIPResponse.GetResponse(
                headerParams.SourceParticipant.Endpoint,
                headerParams.DestinationParticipant.Endpoint,
                statusCode,
                null); // uses status code

            PopulateHeader(response, sipScheme, headerParams);
            return response;
        }

        public static SIPResponse GetResponse(SIPSchemesEnum sipScheme, SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType)
        {
            SIPResponse response = GetResponse(sipScheme, statusCode, headerParams);
            SetBody(response, message, contentType);
            return response;
        }

        private static SIPURI GetSIPURIFor(SIPParticipant participant, SIPSchemesEnum sipScheme, string? paramsAndHeaders = null)
        {
            return new SIPURI(
                participant.Name,
                participant.Endpoint.GetIPEndPoint().ToString(),
                paramsAndHeaders,
                sipScheme, // can the scheme differ for each participant?
                participant.Endpoint.Protocol);
        }

        private static void PopulateHeader(SIPMessageBase message, SIPSchemesEnum sipScheme, SIPHeaderParams headerParams)
        {
            // branch?
            SIPURI FromUri = GetSIPURIFor(headerParams.SourceParticipant, sipScheme);
            SIPURI ToUri = GetSIPURIFor(headerParams.DestinationParticipant, sipScheme);

            message.Header.From = new SIPFromHeader(headerParams.SourceParticipant.Name, FromUri, headerParams.FromTag);
            message.Header.To = new SIPToHeader(headerParams.DestinationParticipant.Name, ToUri, headerParams.ToTag);
            message.Header.CSeq = headerParams.CSeq;
            message.Header.CallId = headerParams.CallID;

            //request.Header.MaxForwards = 70; // 70 is an arbitrary number
            //request.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(SIPScheme, this.SourceParticipant.Endpoint)) };
        }

        private static void SetBody(SIPMessageBase message, string payload, string contentType)
        {
            message.Body = payload;
            message.Header.ContentType = contentType;
        }
    }
}
