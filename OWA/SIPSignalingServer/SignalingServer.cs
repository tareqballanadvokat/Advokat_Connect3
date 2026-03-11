// <copyright file="SignalingServer.cs" company="Advokat GmbH">
// Copyright (c) Advokat GmbH. Alle Rechte vorbehalten.
// </copyright>

namespace SIPSignalingServer
{
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.Diagnostics.CodeAnalysis;
    using System.Net;
    using System.Text.Json;
    using Advokat.WebRTC.Library.SIP;
    using Advokat.WebRTC.Library.SIP.Interfaces;
    using Microsoft.Extensions.Logging;
    using SIPSignalingServer.Interfaces;
    using SIPSignalingServer.Transactions;
    using SIPSorcery.SIP;

    public class SignalingServer
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SignalingServer> logger;

        public IPEndPoint ServerEndpoint { get; private set; }

        private ISIPRegistry registry;

        public SignalingServerOptions Options { get; private set; }

        private ISIPTransport? Transport { get; set; }

        private ISIPConnection? Connection { get; set; }

        private ConcurrentDictionary<string, SIPDialog> dialogs = [];

        private ISIPConnectionPool connectionPool;

        [MemberNotNullWhen(true, nameof(this.Connection))]
        [MemberNotNullWhen(true, nameof(this.Transport))]
        public bool Running { get; private set; }

        public delegate void ServerEventDelegate(SignalingServer sender);

        public event ServerEventDelegate? ServerStarted;

        public event ServerEventDelegate? ServerStopped;

        public SignalingServer(IPEndPoint serverEndpoint, ILoggerFactory loggerFactory)
            : this(serverEndpoint, new SignalingServerOptions(), loggerFactory)
        {
        }

        public SignalingServer(IPEndPoint serverEndpoint, SignalingServerOptions options, ILoggerFactory loggerFactory)
        {
            this.Options = options;
            this.ServerEndpoint = serverEndpoint;

            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SignalingServer>();

            // TODO: Get registry passed
            this.registry = new SIPMemoryRegistry(this.loggerFactory);
            this.connectionPool = new SIPMemoryConnectionPool(this.loggerFactory);
        }

        public void StartServer()
        {
            if (this.Running)
            {
                // server already running
                return;
            }

            this.Transport = this.GetTransport(this.ServerEndpoint);

            this.Connection = new SIPConnection(this.Options.SIPScheme, this.Transport, this.loggerFactory, this.IsRegistrationRequest);
            this.Connection.SIPRequestReceived += this.RequestListener;

            this.Running = true;

            this.ServerStarted?.Invoke(this);
            this.logger.LogInformation("Server started. Listening on {endpoint}", this.ServerEndpoint);
        }

        public void StopServer()
        {

            if (!this.Running)
            {
                // server not running
                return;
            }

            this.Connection.SIPRequestReceived -= this.RequestListener;

            // TODO: close all connections properly. STOP all Dialogs
            //foreach (KeyValuePair<string, SIPDialog> dialogEntry in this.dialogs)
            //{
            //    // TODO: Remove listener for TransactionStopped. -> it tries to remove the dialog. Cannot be removed while iterating over dict
            //    await dialogEntry.Value.DisposeAsync();
            //}

            this.Transport = null;

            this.Connection = null;
            this.Running = false;
            this.logger.LogInformation("Server stopped");

        }

        private bool IsRegistrationRequest(SIPMessageBase message)
        {
            // TODO: check here? - pretty sure yes
            return (message is SIPRequest request
                && request.Method == SIPMethodsEnum.REGISTER
                && request.Header.CSeq == 1);
        }

        private ISIPTransport GetTransport(IPEndPoint sourceEndpoint)
        {
            if (this.Options.SIPChannels.Count == 0)
            {
                throw new ArgumentException("No SIPChannel set in options. Cannot create a SIP connection.");
            }
            // TODO: threw an InvalidOperationException --> probably multiple processes on same socket

            return new Advokat.WebRTC.Library.SIP.Utils.SIPTransport(sourceEndpoint, this.Options.SIPChannels, this.Options.SSLCertificate);
        }

        /// <summary>General listener for all requests from clients.</summary>
        /// <version date="20.03.2025" sb="MAC"></version>
        private async Task RequestListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method == SIPMethodsEnum.REGISTER)
            {
                await this.StartConnection(localEndPoint, sipRequest);
            }

            // TODO: implement other paths - Options, BadRequest, Code registration / deletion
        }

        private async Task StartConnection(SIPEndPoint localEndPoint, SIPRequest sipRequest)
        {
            ISIPDialogConfig config = this.GetConfig(sipRequest);

            bool existing = this.dialogs.TryGetValue(sipRequest.Header.From.FromName, out SIPDialog? existingDialog);
            if (existing && existingDialog != null)
            {
                await existingDialog.Stop();
                this.dialogs.TryRemove(new KeyValuePair<string, SIPDialog>(sipRequest.Header.From.FromName, existingDialog));
                await existingDialog.DisposeAsync();
            }

            SIPDialog sipDialog = new SIPDialog(this.Options.SIPScheme, this.Transport!, sipRequest, localEndPoint, this.registry, this.connectionPool, this.loggerFactory);
            this.dialogs.TryAdd(sipRequest.Header.From.FromName, sipDialog);

            // TODO: remove async event
            sipDialog.TransactionStopped += async (ISIPTransaction sender) =>
            {
                if (sender is SIPDialog dialog)
                {
                    // TODO: ArgumentNullException -> key was null?? --> breakpoint in SIPDialog StartRunning
                    bool success = this.dialogs.TryRemove(dialog.Params.ClientParticipant.Name, out SIPDialog? _);
                    await dialog.DisposeAsync();
                }
            };

            sipDialog.Config = config;
            await sipDialog.Start();
        }

        private ISIPDialogConfig GetConfig(SIPRequest initialRequest)
        {
            ISIPDialogConfig config = (ISIPDialogConfig)this.Options.SIPConfig.Clone();

            if (this.Options.AllowClientConfigs == false)
            {
                return config;
            }

            if (!(initialRequest.Header.ContentType == "text/json"
                && initialRequest.Header.ContentLength > 0
                && initialRequest.Body.Length > 0))
            {
                return config;
            }

            SIPDialogConfig? clientConfig;

            try
            {
                clientConfig = JsonSerializer.Deserialize<SIPDialogConfig>(initialRequest.Body);
            }
            catch (JsonException ex)
            {
                return config;
            }

            if (clientConfig == null)
            {
                return config;
            }

            // TODO: check what happens when an attribute is sent as null or left out in json
            config.ConnectionTimeout = Math.Min(clientConfig.ConnectionTimeout, config.ConnectionTimeout);
            config.RegistrationTimeout = Math.Min(clientConfig.RegistrationTimeout, config.RegistrationTimeout);
            config.PeerRegistrationTimeout = clientConfig.PeerRegistrationTimeout; // override from client config
            // ReceiveTimeout is left out on purpose - one way latency

            return config;
        }
    }
}
