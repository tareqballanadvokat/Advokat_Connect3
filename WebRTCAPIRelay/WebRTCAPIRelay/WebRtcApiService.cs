using Advokat.Connector.Library;
using Advokat.Connector.Plugin;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using WebRTCAPIRelay.Cache;
using WebRTCAPIRelay.DTOs;
using WebRTCClient;

namespace WebRTCAPIRelay
{
    // TODO: Disposable - close all connections
    public class WebRtcApiService
    {
        private WebRTCPeer UserAgent { get; set; }

        private RequestCache RequestCache { get; set; } = new RequestCache();

        private IServiceProvider? Services { get; set; }

        private static JsonSerializerOptions JsonOptions = new JsonSerializerOptions()
        {
            AllowTrailingCommas = true,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.KebabCaseLower
        };

        public WebRtcApiService()
        {
            // TODO:
            // pass config for signaling server endpoint and ice servers (STUN and TURN server hosted on Advokat.com?)
            // after implementing multiple connections with the same registration, caller should be empty
            // remote should be a unique string - does every server have an id? Or request a unique id from signaling server?

            string callerName = "macc";
            string remoteName = "macs";

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
            this.UserAgent.WebRTCConfig.SIPClientConfig.PeerRegistrationTimeout = null;
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
            if (!ChecksumChecksOut(data))
            {
                // TODO: some sort of response to tell the client to send this request again
                //       should we parse it first? if the data is corrupted there is a good possibility that the deserialization does not work
                
                //await BadRequest(sender);

                return;
            }

            WebRTCRequest? webRtcRequest = ParseRequest(data);

            if (webRtcRequest == null)
            {
                await BadRequest(sender);
                return;
            }

            if (!RequestIsValid(webRtcRequest.Payload))
            {
                await BadRequest(sender);
                return;
            }

            // TODO: cache should be seperate for each connection. Currently the cache is global. Other clients can get cached responses of other clients if they get the ID.
            //       If the current implementation stays where every connection generates it's own certificate the Id can only be read from the client or server, in that case
            //       another layer of security here would be pointless.

            //       Although a DTLS connection is not secured from man in the middle attacks. The certificate does not get evaluated for a CA. It is always self signed.
            WebRTCResponse? webRtcResponse = this.RequestCache.GetCachedResponse(webRtcRequest);
            if (webRtcResponse == null)
            {
                WebRTCResponsePayload responsePayload = await this.GetAPIResponse(webRtcRequest.Payload);
                webRtcResponse = new WebRTCResponse()
                {
                    Checksum = GetChecksum(responsePayload),
                    Payload = responsePayload
                };

                this.RequestCache.CacheResponse(webRtcResponse);
            }

            await this.SendResponse(sender, webRtcResponse);
        }

        private async Task<WebRTCResponsePayload> GetAPIResponse(WebRTCRequestPayload request)
        {
            RequestPayload httpRequest = new RequestPayload()
            {
                Method = request.Method,
                Uri = request.Uri,
                Headers = request.Headers,
                Body = request.Body
            };

            using var serviceScope = this.Services.CreateScope();
            IRequestHandler requestHandler = serviceScope.ServiceProvider.GetRequiredService<IRequestHandler>();
            ResponsePayload httpResponse = await requestHandler.InvokeAsync(httpRequest);

            return new WebRTCResponsePayload()
            {
                Id = request.Id,
                Timestamp = DateTime.Now.Ticks,
                StatusCode = httpResponse.StatusCode,
                Headers = httpResponse.Headers,
                Body = httpResponse.Content
            };
        }

        private async Task SendResponse(IWebRTCPeer channel, WebRTCResponse response)
        {
            string responseString = JsonSerializer.Serialize(response, JsonOptions);
            await channel.SendMessageToPeer(responseString);
        }

        private static WebRTCRequest? ParseRequest(byte[] data)
        {
            string requestString = Encoding.UTF8.GetString(data);
            WebRTCRequest? request;
            try
            {
                request = JsonSerializer.Deserialize<WebRTCRequest>(data, JsonOptions);
            }
            catch (JsonException)
            {
                // cannot be parsed -> bad request
                //  TODO: parsing error. No id to tell the caller which request to resend
                return null;
            }

            if (request == null)
            {
                // cannot be parsed -> bad request
                //  TODO: parsing error. No id to tell the caller which request to resend
                return null;
            }

            return request;
        }

        private bool ChecksumChecksOut(byte[] rawRequest)
        {
            JsonDocument request;

            try
            {
                request = JsonDocument.Parse(rawRequest, new JsonDocumentOptions() { AllowTrailingCommas = JsonOptions.AllowTrailingCommas });
            }
            catch (JsonException)
            {
                // TODO: parsing error. No id to tell the caller which request to resend
                return false;
            }

            JsonElement checksum;
            JsonElement payload;
            try
            {
                JsonElement rootElement = request.RootElement;

                checksum = rootElement.GetProperty("checksum");
                payload = rootElement.GetProperty("request");
            }
            catch (KeyNotFoundException ex)
            {
                // TODO: parsing error. No id to tell the caller which request to resend
                return false;
            }

            string checksumRawText = checksum.ToString();
            byte[] sentChecksum;
            try
            {
                sentChecksum = Convert.FromBase64String(checksumRawText);
            }
            catch (FormatException)
            {
                // The checksum is not base64 encoded
                return false;
            }

            byte[] calculatedChecksum = MD5.HashData(Encoding.UTF8.GetBytes(payload.GetRawText()));
            return sentChecksum.SequenceEqual(calculatedChecksum);
        }

        private static bool RequestIsValid(WebRTCRequestPayload request)
        {
            if (request.Timestamp > DateTime.Now.Ticks) // TODO also check if the request is expired (older than 10 min? what threshold)
            {
                // request from the future ?!?
                return false;
            }

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

        private static byte[] GetChecksum(WebRTCResponsePayload responsePayload)
        {
            string serializedPayload = JsonSerializer.Serialize(responsePayload, JsonOptions);
            return  MD5.HashData(Encoding.UTF8.GetBytes(serializedPayload));
        }

        private static async Task BadRequest(IWebRTCPeer sender)
        {
            ResponsePayload response = new ResponsePayload()
            {
                StatusCode = (int)HttpStatusCode.BadRequest,
                StatusText = HttpStatusCode.BadRequest.ToString(),
                // TODO: headers?
            };
            await sender.SendMessageToPeer(System.Text.Json.JsonSerializer.Serialize(response, JsonOptions));
        }
    }
}
