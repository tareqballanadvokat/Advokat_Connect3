using SIPSignalingServer.Models;

namespace SIPSignalingServer
{
    internal class SIPRegisty
    {
        private List<SIPRegistration> RegisteredConnections { get; set; }

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
                SIPRegistration registeredObject = this.RegisteredConnections.Single(r => r.SourceUserName == registration.SourceUserName
                                                                                        && r.RemoteUserName == registration.RemoteUserName);

                RegisteredConnections.Remove(registeredObject);
            }
        }

        public bool IsRegistered(SIPRegistration registration)
        {
            return this.RegisteredConnections.Any(r => r.SourceUserName == registration.SourceUserName
                                                    && r.RemoteUserName == registration.RemoteUserName);

            //return this.RegisteredConnections.Contains(registration); // TODO: implemet model comparison?
        }
    }
}
