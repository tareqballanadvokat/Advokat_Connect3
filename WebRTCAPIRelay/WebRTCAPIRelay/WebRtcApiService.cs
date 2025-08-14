using Advokat.Connector.Library;
using Advokat.Connector.Plugin;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using WebRTCAPIRelay.DTOs;
using WebRTCClient;

namespace WebRTCAPIRelay
{
    // TODO: Disposable - close all connections
    public class WebRtcApiService
    {
        private WebRTCPeer UserAgent { get; set; }

        private IServiceProvider? Services { get; set; }

        private static JsonSerializerOptions JsonOptions = new JsonSerializerOptions()
        {
            AllowTrailingCommas = true,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        };

        public WebRtcApiService()
        {
            // TODO:
            // pass config for signaling server endpoint and ice servers (STUN and TURN server hosted on Advokat.com?)
            // after implementing multiple connections with the same registration, caller should be empty
            // remote should be a unique string - does every server have an id? Or request a unique id from signaling server?

            string callerName = "caller";
            string remoteName = "remote";

            IPEndPoint? remoteEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).LastOrDefault(), 7008);
            IPEndPoint signalingServerEndpoint = new IPEndPoint(IPAddress.Loopback, 8009);

            this.UserAgent = new WebRTCPeer(
                sourceUser: remoteName,
                remoteUser: callerName,
                sourceEndpoint: remoteEndpoint,
                signalingServer: signalingServerEndpoint,
                iceServers: [],
                NullLoggerFactory.Instance
                );
        }

        /// <summary>Starts the connection with the signaling server and waits for callers to connect over WebRTC.
        ///          Dependent on the services HttpClient, IRequestHandler.</summary>
        /// <param name="services">ServiceProvider for gathering services.</param>
        /// <version date="30.07.2025" sb="MAC">AKP-441 Created.</version>
        [MemberNotNull(nameof(this.Services))]
        public async Task StartWebRTC(IServiceProvider services)
        {
            this.Services = services;

            // checks if requesthandler is registerd as a service.
            var _ = services.GetRequiredService<IRequestHandler>();

            this.UserAgent.OnMessageReceived += this.HandleRequest;
            
            // TODO: Reconnect to the SIP server if it disconnects.
            await this.UserAgent.Connect();
        }

        private async Task HandleRequest(IWebRTCPeer sender, byte[] data)
        {
            using var serviceScope = this.Services.CreateScope();
            RequestPayload? request = ParseRequest(data, serviceScope.ServiceProvider);

            if (request == null)
            {
                await BadRequest(sender);
                return;
            }

            IRequestHandler requestHandler = serviceScope.ServiceProvider.GetRequiredService<IRequestHandler>();
            ResponsePayload response = await requestHandler.InvokeAsync(request);

            string? content = response.Content != null ? Encoding.UTF8.GetString(response.Content) : null;

            WebRTCResponsePayload webRTCResponse = new WebRTCResponsePayload()
            {
                StatusCode = response.StatusCode,
                StatusText = response.StatusText,
                Headers = response.Headers,
                Content = content
            };

            string responseString = JsonSerializer.Serialize(webRTCResponse, JsonOptions);

            await sender.SendMessageToPeer(responseString);
        }

        private static RequestPayload? ParseRequest(byte[] data, IServiceProvider serviceProvider)
        {
            string requestString = Encoding.UTF8.GetString(data);
            RequestPayload? request;
            try
            {
                request = JsonSerializer.Deserialize<RequestPayload>(data, JsonOptions);
            }
            catch (JsonException)
            {
                // cannot be parsed -> bad request
                return null;
            }

            if (request == null)
            {
                // cannot be parsed -> bad request
                return null;
            }

            if (!RequestIsValid(request))
            {
                return null;
            }

            return request;
        }

        private static bool RequestIsValid(RequestPayload request)
        {
            try
            {
                new Uri(request.Uri, UriKind.Relative);
            }
            catch (UriFormatException)
            {
                return false;
            }

            return true;
        }

        private static async Task BadRequest(IWebRTCPeer sender)
        {
            ResponsePayload response = new ResponsePayload()
            {
                StatusCode = (int)HttpStatusCode.BadRequest,
                StatusText = HttpStatusCode.BadRequest.ToString(),
                // TODO: headers?
            };
            await sender.SendMessageToPeer(JsonSerializer.Serialize(response, JsonOptions));
        }
    }
}
