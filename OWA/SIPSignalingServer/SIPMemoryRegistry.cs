// <copyright file="SIPMemoryRegistry.cs" company="Advokat GmbH">
// Copyright (c) Advokat GmbH. Alle Rechte vorbehalten.
// </copyright>

namespace SIPSignalingServer
{
    using Microsoft.Extensions.Logging;
    using SIPSignalingServer.Interfaces;
    using SIPSignalingServer.Models;
    using SIPSignalingServer.Utils.CustomEventArgs;

    internal class SIPMemoryRegistry : ISIPRegistry
    {
        private ILogger logger;

        private readonly object lockObject = new object();

        public event EventHandler<RegistrationEventArgs>? Unregistered;

        public event EventHandler<RegistrationEventArgs>? Registered;

        private List<SIPRegistration> Registrations { get; set; } = new List<SIPRegistration>();

        public SIPMemoryRegistry(ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPMemoryRegistry>();
        }

        public void Register(SIPRegistration registration)
        {
            lock (this.lockObject)
            {
                if (!this.IsRegistered(registration))
                {
                    this.logger.LogDebug("Registering. Caller:'{caller}' remote:\"{remote name}\".", registration.SourceParticipant, registration.RemoteUser);
                    this.Registrations.Add(registration);
                }
            }
        }

        public void Unregister(SIPRegistration registration)
        {
            lock (this.lockObject)
            {
                SIPRegistration? registeredObject = this.GetRegisteredObject(registration);
                if (registeredObject != null)
                {
                    this.logger.LogDebug("Unregistering. Caller:'{caller}' remote:\"{remote name}\".", registration.SourceParticipant, registration.RemoteUser);
                    this.Registrations.Remove(registeredObject);
                    registeredObject.Confirmed = false;
                    registration.Confirmed = false;
                    this.Unregistered?.Invoke(this, new RegistrationEventArgs(registeredObject));
                }
            }
        }

        public void Confirm(SIPRegistration registration)
        {
            lock (this.lockObject)
            {
                SIPRegistration? registeredObject = this.GetRegisteredObject(registration);
                if (registeredObject != null)
                {
                    this.logger.LogDebug("Confirmed registration. Caller:'{caller}' remote:\"{remote name}\".", registration.SourceParticipant, registration.RemoteUser);
                    registeredObject.Confirmed = registration.Confirmed = true;

                    this.Registered?.Invoke(this, new RegistrationEventArgs(registration));
                }
            }
        }

        public bool IsConfirmed(SIPRegistration registration)
        {
            lock (this.lockObject)
            {
                return this.GetRegisteredObject(registration)?.Confirmed
                    ?? false; // not in Registry, cannot be confirmed
            }
        }

        public bool IsRegistered(SIPRegistration registration)
        {
             // TODO: && Confirmed?
            return this.Registrations.Contains(registration);
        }

        //public bool IsRegistered(string name)
        //{
        //    return this.GetRegisteredObject(name) != null;
        //}

        public SIPRegistration? GetRegisteredObject(SIPRegistration registration)
        {
            if (!this.IsRegistered(registration))
            {
                // not registered, cannot retrun obj
                return null;
            }

            return this.Registrations.Single(r => r == registration);
        }

        public SIPRegistration? GetRegisteredObject(string name)
        {
            // TODO: What to do on multiple registartions with the same name? Only allow the name once when adding?

            lock (this.lockObject)
            {
                return this.Registrations.SingleOrDefault(r => r.SourceParticipant.Name == name);
            }
        }

        public List<SIPRegistration> GetPeerRegistration(SIPRegistration registration)
        {
            lock (this.lockObject)
            {
                return this.Registrations.Where(registration.IsPeer).ToList();
            }
        }
    }
}
