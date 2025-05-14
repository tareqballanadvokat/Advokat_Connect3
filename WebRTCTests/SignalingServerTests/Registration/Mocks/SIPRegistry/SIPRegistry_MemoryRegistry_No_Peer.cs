using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;

namespace SignalingServerTests.Registration.Mocks.SIPRegistry
{
    internal class SIPRegistry_MemoryRegistry_No_Peer : ISIPRegistry
    {
        public List<SIPRegistration> AddedToRegistry = [];
        public List<SIPRegistration> Confirmed = [];
        public List<SIPRegistration> Unregistered = [];

        public void Confirm(SIPRegistration registration)
        {
            this.Confirmed.Add(registration);
        }

        public SIPRegistration? GetPeerRegistration(SIPRegistration registration)
        {
            return null;
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
            return false;
        }

        public bool IsRegistered(SIPRegistration registration)
        {
            return false;
        }

        public bool PeerIsRegistered(SIPRegistration registration)
        {
            return false;
        }

        public void Register(SIPRegistration registration)
        {
            this.AddedToRegistry.Add(registration);
        }

        public void Unregister(SIPRegistration registration)
        {
            this.Unregistered.Add(registration);
        }
    }
}
