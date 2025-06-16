using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;

namespace SignalingServerTests.SIPConnection.Mocks.SIPRegistry
{
    internal class SIPRegistry_Is_Registered(ServerSideTransactionParams peerRegistrationParams) : ISIPRegistry
    {
        public void Confirm(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public SIPSignalingServer.Models.SIPRegistration? GetPeerRegistration(SIPSignalingServer.Models.SIPRegistration registration)
        {
            return new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams);
        }

        public SIPSignalingServer.Models.SIPRegistration? GetRegisteredObject(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public SIPSignalingServer.Models.SIPRegistration? GetRegisteredObject(string name)
        {
            throw new NotImplementedException();
        }

        public bool IsConfirmed(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public bool IsRegistered(SIPSignalingServer.Models.SIPRegistration registration)
        {
            return true;
        }

        public bool PeerIsRegistered(SIPSignalingServer.Models.SIPRegistration registration)
        {
            return true;
        }

        public void Register(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public void Unregister(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }
    }
}
