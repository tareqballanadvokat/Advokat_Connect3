using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP.Utils
{
    public static class SIPHelper
    {
        public static SIPRequest GetRequest(SIPSchemesEnum sipScheme, SIPMethodsEnum method, SIPHeaderParams headerParams, string? message = null)
        {
            // branch?
            SIPRequest request = SIPRequest.GetRequest(
                method,
                new SIPURI(
                    sipScheme,
                    headerParams.DestinationParticipant.Endpoint.Address,
                    headerParams.DestinationParticipant.Endpoint.Port));

            SIPURI FromUri = GetSIPURIFor(headerParams.SourceParticipant, sipScheme);
            SIPURI ToUri = GetSIPURIFor(headerParams.DestinationParticipant, sipScheme);

            request.Header.From = new SIPFromHeader(headerParams.SourceParticipant.Name, FromUri, headerParams.FromTag);
            request.Header.To = new SIPToHeader(headerParams.DestinationParticipant.Name, ToUri, headerParams.ToTag);
            request.Header.CSeq = headerParams.CSeq;
            request.Header.CallId = headerParams.CallID;
            //request.Header.MaxForwards = 70; // 70 is an arbitrary number

            // TODO: add message
            //request.Body = "";
            //request.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(SIPScheme, this.SourceParticipant.Endpoint)) };

            return request;
        }

        public static SIPResponse GetResponse(SIPSchemesEnum sipScheme, SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string? message = null)
        {
            // branch?
            SIPResponse response = SIPResponse.GetResponse(
                headerParams.SourceParticipant.Endpoint,
                headerParams.DestinationParticipant.Endpoint,
                statusCode,
                message);
            //new SIPURI(
            //    this.SIPScheme,
            //    headerParams.RemoteParticipant.Endpoint.Address,
            //    headerParams.RemoteParticipant.Endpoint.Port));

            //SIPURI FromUri = this.GetSIPURIFor(headerParams.SourceParticipant);
            //SIPURI ToUri = this.GetSIPURIFor(headerParams.RemoteParticipant);

            //request.Header.From = new SIPFromHeader(headerParams.SourceParticipant.Name, FromUri, headerParams.FromTag);
            //request.Header.To = new SIPToHeader(headerParams.RemoteParticipant.Name, ToUri, headerParams.ToTag);
            response.Header.CSeq = headerParams.CSeq;
            response.Header.CallId = headerParams.CallID;

            return response;
        }

        public static SIPURI GetSIPURIFor(SIPParticipant participant, SIPSchemesEnum sipScheme, string? paramsAndHeaders = null)
        {
            return new SIPURI(
                participant.Name,
                participant.Endpoint.GetIPEndPoint().ToString(),
                paramsAndHeaders,
                sipScheme, // can the scheme differ for each participant?
                participant.Endpoint.Protocol);
        }
    }
}
