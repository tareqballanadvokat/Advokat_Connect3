using SIPSorcery.Net;

namespace OutlookAddIn.WebAPI.Services
{
    public interface IPeerConnection
    {
        Task<RTCPeerConnection> Start();
    }
}
