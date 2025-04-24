using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;

namespace SIPSignalingServer
{
    //TODO: make interface - change this to memory registry - registry could be db or file
 
    internal class SIPRegistry
    {
        private ILogger logger;

        // TODO: locking when adding / removing from list?
        private List<SIPRegistration> RegisteredConnections { get; set; } = new List<SIPRegistration>();

        public SIPRegistry(ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPRegistry>();
        }

        public void Register(SIPRegistration registration)
        {
            if (!this.IsRegistered(registration))
            {
                this.logger.LogDebug("Registering. Caller:'{caller}' remote:\"{remote name}\".", registration.SourceParticipant, registration.RemoteUser);
                RegisteredConnections.Add(registration);
            }
        }

        public void Unregister(SIPRegistration registration)
        {
            SIPRegistration? registeredObject = this.GetRegisteredObject(registration);
            if (registeredObject != null)
            {
                this.logger.LogDebug("Unregistering. Caller:'{caller}' remote:\"{remote name}\".", registration.SourceParticipant, registration.RemoteUser);
                RegisteredConnections.Remove(registeredObject);
            }
        }

        public void Confirm(SIPRegistration registration)
        {
            SIPRegistration? registeredObject = this.GetRegisteredObject(registration);
            if (registeredObject != null)
            {
                this.logger.LogDebug("Confirmed registration. Caller:'{caller}' remote:\"{remote name}\".", registration.SourceParticipant, registration.RemoteUser);
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
            SIPRegistration? peerRegistration = this.GetPeerRegistration(registration);
            return peerRegistration != null
                && peerRegistration.RemoteUser == registration.SourceParticipant.Name
                && peerRegistration.Confirmed;
        }

        public SIPRegistration? GetPeerRegistration(SIPRegistration registration)
        {
            // TODO: We assume the remote connects first. If the remote connects later without a targer client (RemoteUser) this breaks
            return this.GetRegisteredObject(registration.RemoteUser);
        }
    }
}
