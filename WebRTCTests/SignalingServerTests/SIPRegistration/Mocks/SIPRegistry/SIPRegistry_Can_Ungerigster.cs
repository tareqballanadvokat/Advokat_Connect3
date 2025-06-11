using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;

namespace SignalingServerTests.SIPRegistration.Mocks.SIPRegistry
{
    internal class SIPRegistry_Can_Ungerigster : ISIPRegistry
    {
        List<SIPSignalingServer.Models.SIPRegistration> unregisteredRegistrations = [];

        public void Confirm(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public SIPSignalingServer.Models.SIPRegistration? GetPeerRegistration(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
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
            throw new NotImplementedException();
        }

        public bool PeerIsRegistered(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public void Register(SIPSignalingServer.Models.SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public void Unregister(SIPSignalingServer.Models.SIPRegistration registration)
        {
            this.unregisteredRegistrations.Add(registration);
        }
    }
}
