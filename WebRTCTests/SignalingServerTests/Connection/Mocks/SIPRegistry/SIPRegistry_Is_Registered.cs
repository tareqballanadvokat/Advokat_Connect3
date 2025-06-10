using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;

namespace SignalingServerTests.Connection.Mocks.SIPRegistry
{
    internal class SIPRegistry_Is_Registered(ServerSideTransactionParams peerRegistrationParams) : ISIPRegistry
    {
        public void Confirm(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public SIPRegistration? GetPeerRegistration(SIPRegistration registration)
        {
            return new SIPRegistration(peerRegistrationParams);
        }

        public SIPRegistration? GetRegisteredObject(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public SIPRegistration? GetRegisteredObject(string name)
        {
            throw new NotImplementedException();
        }

        public bool IsConfirmed(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public bool IsRegistered(SIPRegistration registration)
        {
            return true;
        }

        public bool PeerIsRegistered(SIPRegistration registration)
        {
            return true;
        }

        public void Register(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public void Unregister(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }
    }
}
