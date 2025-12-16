using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;

namespace SIPSignalingServer.Interfaces
{
    public interface ISIPRegistry
    {
        public event EventHandler<RegistrationEventArgs>? Unregistered;

        public void Register(SIPRegistration registration);

        public void Unregister(SIPRegistration registration);

        public void Confirm(SIPRegistration registration);

        public bool IsConfirmed(SIPRegistration registration);

        public bool IsRegistered(SIPRegistration registration);

        public SIPRegistration? GetRegisteredObject(SIPRegistration registration);

        public SIPRegistration? GetRegisteredObject(string name);

        public bool PeerIsRegistered(SIPRegistration registration);

        public SIPRegistration? GetPeerRegistration(SIPRegistration registration);
    }
}
