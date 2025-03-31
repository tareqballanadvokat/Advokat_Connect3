using SIPSignalingServer.Models;

namespace SIPSignalingServer
{
    internal class SIPRegisty
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
            if (this.IsRegistered(registration))
            {
                SIPRegistration registeredObject = this.RegisteredConnections.Single(r => r == registration);
                RegisteredConnections.Remove(registeredObject);
            }
        }

        public bool IsRegistered(SIPRegistration registration)
        {
            return this.RegisteredConnections.Contains(registration);
        }
    }
}
