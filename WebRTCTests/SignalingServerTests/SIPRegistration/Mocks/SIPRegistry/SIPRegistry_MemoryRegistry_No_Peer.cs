using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;

namespace SignalingServerTests.SIPRegistration.Mocks.SIPRegistry
{
    internal class SIPRegistry_MemoryRegistry_No_Peer : ISIPRegistry
    {
        public List<SIPSignalingServer.Models.SIPRegistration> AddedToRegistry = [];
        public List<SIPSignalingServer.Models.SIPRegistration> Confirmed = [];
        public List<SIPSignalingServer.Models.SIPRegistration> Unregistered = [];

        public void Confirm(SIPSignalingServer.Models.SIPRegistration registration)
        {
            this.Confirmed.Add(registration);
        }

        public SIPSignalingServer.Models.SIPRegistration? GetPeerRegistration(SIPSignalingServer.Models.SIPRegistration registration)
        {
            return null;
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
            return false;
        }

        public bool IsRegistered(SIPSignalingServer.Models.SIPRegistration registration)
        {
            return false;
        }

        public bool PeerIsRegistered(SIPSignalingServer.Models.SIPRegistration registration)
        {
            return false;
        }

        public void Register(SIPSignalingServer.Models.SIPRegistration registration)
        {
            this.AddedToRegistry.Add(registration);
        }

        public void Unregister(SIPSignalingServer.Models.SIPRegistration registration)
        {
            this.Unregistered.Add(registration);
        }
    }
}
