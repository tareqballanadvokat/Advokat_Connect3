using SIPSorcery.SIP;
using WebRTCCallerLibrary.Models;

namespace WebRTCCallerLibrary
{
    public class AbstractSIPMessager
    {

        protected virtual SIPHeaderParams GetHeaderParams(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            string? fromTag = null,
            string? toTag = null,
            int cSeq = 1,
            string? callID = null)
        {
            return new SIPHeaderParams(
                sourceParticipant,
                remoteParticipant,
                fromTag: fromTag,
                toTag: toTag,
                cSeq: cSeq,
                callID: callID);
        }

        protected virtual SIPHeaderParams GetHeaderParamsForResponseTo(SIPParticipant sourceParticipant, SIPParticipant remoteParticipant, SIPResponse response, string? callId = null)
        {
            SIPHeaderParams sipHeaderParams = this.GetHeaderParams(
                sourceParticipant,
                remoteParticipant,
                fromTag: response.Header.To.ToTag,
                toTag: response.Header.From.FromTag,
                cSeq: response.Header.CSeq + 1,
                callId);

            return sipHeaderParams;
        }
    }
}
