using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;

namespace SignalingServerTests.Registration.Mocks.SIPRegistry
{
    internal class SIPRegistry_Can_Ungerigster : ISIPRegistry
    {
        List<SIPRegistration> unregisteredRegistrations = [];

        public void Confirm(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public SIPRegistration? GetPeerRegistration(SIPRegistration registration)
        {
            throw new NotImplementedException();
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
            throw new NotImplementedException();
        }

        public bool PeerIsRegistered(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public void Register(SIPRegistration registration)
        {
            throw new NotImplementedException();
        }

        public void Unregister(SIPRegistration registration)
        {
            this.unregisteredRegistrations.Add(registration);
        }
    }
}
