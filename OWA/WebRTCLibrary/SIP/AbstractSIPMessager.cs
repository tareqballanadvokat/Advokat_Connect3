using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP
{
    public class AbstractSIPMessager
    {
        // TODO: remove

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

        protected virtual SIPHeaderParams GetHeaderParamsForResponseTo(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            SIPMessageBase message,
            string? fromTag = null,
            string? toTag = null,
            string? callId = null)
        {
            SIPHeaderParams sipHeaderParams = this.GetHeaderParams(
                sourceParticipant,
                remoteParticipant,
                fromTag: toTag ?? message.Header.To.ToTag,
                toTag: fromTag ?? message.Header.From.FromTag,
                cSeq: message.Header.CSeq + 1,
                callId);

            return sipHeaderParams;
        }
    }
}
