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

        public SIPRegistration? GetRegisteredObject(SIPRegistration registration)
        {
            if (!this.IsRegistered(registration))
            {
                // not registered, cannot retrun obj
                return null;
            }

            return this.RegisteredConnections.Single(r => r == registration);
        }
    }
}
