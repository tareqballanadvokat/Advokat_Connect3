using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Models;
using static WebRTCLibrary.SIP.SIPConnection;

namespace WebRTCLibrary.SIP
{
    internal class SIPTunnelManager : AbstractSIPMessager
    {
        public SIPConnection Connection { get; private set; }

        private bool Connecting { get; set; }

        public bool Connected { get; private set; }

        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        public string CallID { get; private set; }

        internal SIPTunnelManager(SIPConnection connection, SIPParticipant sourceParticipant, SIPParticipant remoteParticipant, string callID)
        {
            this.Connection = connection;
            this.SourceParticipant = sourceParticipant;
            this.RemoteParticipant = remoteParticipant;
            this.CallID = callID;
        }

        public void ListenForConnection()
        {
            this.Connecting = true;
            this.Connection.SIPRequestReceived += this.ConnectionAvailableListener;
        }


        private async Task ConnectionAvailableListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method == SIPMethodsEnum.NOTIFY
                && this.Connecting
                && sipRequest.Header.CSeq == 1 // first message in conversation
                // TODO: implement this comparison better - is it even needed?
                //&& remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()
                )
            {
                string fromTag = CallProperties.CreateNewTag();

                // TODO: figure out how to stop listening
                this.Connection.SIPRequestReceived += GetRequestListener(
                    this.ConnectionEstablishedListener,
                    fromTag: sipRequest.Header.From.FromTag,
                    toTag: fromTag); // fromTag of response == toTag of request

                SIPHeaderParams headerParams = this.GetHeaderParamsForResponseTo(sipRequest, fromTag: fromTag);

                // TODO: do something with the result
                SocketError result = await this.Connection.SendSIPRequest(SIPMethodsEnum.ACK, headerParams);
            }
        }

        private async Task ConnectionEstablishedListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest, string? fromTag = null, string? toTag = null)
        {
            if (sipRequest.Method == SIPMethodsEnum.NOTIFY
                && sipRequest.Header.CSeq != 3
                // TODO: implement this comparison better - is it even needed?
                //&& remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()
                
                && sipRequest.Header.To.ToTag == toTag
                && sipRequest.Header.From.FromTag == fromTag
                )
            {
                this.Connecting = false;
                this.Connected = true;
                this.Connection.SIPRequestReceived -= this.ConnectionAvailableListener;
            }
        }

        private SIPHeaderParams GetHeaderParamsForResponseTo(SIPMessageBase message, string? fromTag = null, string? toTag = null)
        {
            return this.GetHeaderParamsForResponseTo(
                this.SourceParticipant,
                this.RemoteParticipant,
                message,
                fromTag: fromTag,
                toTag: toTag,
                callId: this.CallID
                );
        }
    }
}
