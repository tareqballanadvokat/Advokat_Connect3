using SIPSignalingServer.Models;

namespace SIPSignalingServer
{
    internal class SIPRegistry
    {
        // TODO: locking when adding / removing from list?
        private List<SIPRegistration> RegisteredConnections { get; set; } = new List<SIPRegistration>();

        public void Register(SIPRegistration registration)
        {
            if (!this.IsRegistered(registration))
            {
                RegisteredConnections.Add(registration);
            }
        }

        public void Unregister(SIPRegistration registration)
        {
            SIPRegistration? registeredObject = this.GetRegisteredObject(registration);
            if (registeredObject != null)
            {
                RegisteredConnections.Remove(registeredObject);
            }
        }

        public void Confirm(SIPRegistration registration)
        {
            SIPRegistration? registeredObject = this.GetRegisteredObject(registration);
            if (registeredObject != null)
            {
                registeredObject.Confirmed = registration.Confirmed = true;
            }
        }

        public bool IsConfirmed(SIPRegistration registration)
        {
            return this.GetRegisteredObject(registration)?.Confirmed
                ?? false; // not registered, cannot be confirmed
        }

        public bool IsRegistered(SIPRegistration registration)
        {
            return this.RegisteredConnections.Contains(registration);
        }
        public bool IsRegistered(string name)
        {
            return this.GetRegisteredObject(name) != null;
        }

        public SIPRegistration? GetRegisteredObject(SIPRegistration registration)
        {
            if (!this.IsRegistered(registration))
            {
                // not registered, cannot retrun obj
                return null;
            }

            return this.RegisteredConnections.Single(r => r == registration);
        }

        public SIPRegistration? GetRegisteredObject(string name)
        {
            // TODO: What to do on multiple registartions with the same name? Only allow the name once when adding?
            return this.RegisteredConnections.SingleOrDefault(r => r.SourceParticipant.Name == name);
        }

        public bool PeerIsRegistered(SIPRegistration registration)
        {
            SIPRegistration? peerRegistration = this.GetRegisteredObject(registration.RemoteUser);
            return peerRegistration != null
                && peerRegistration.RemoteUser == registration.SourceParticipant.Name; 

        }
    }
}
