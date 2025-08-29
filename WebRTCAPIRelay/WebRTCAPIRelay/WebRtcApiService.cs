using Advokat.Connector.Library;
using Advokat.Connector.Plugin;
using Microsoft.Extensions.DependencyInjection;
using System.Diagnostics.CodeAnalysis;
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
        private IWebRTCPeer UserAgent { get; set; }

        private IRequestCache RequestCache { get; set; }

        private IServiceProvider Services { get; set; }

        private static JsonSerializerOptions JsonOptions = new JsonSerializerOptions()
        {
            AllowTrailingCommas = true,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.KebabCaseLower
        };

        public WebRtcApiService(IServiceProvider services)
        {
            this.Services = services;
            this.RequestCache = services.GetRequiredService<IRequestCache>();
            this.UserAgent = services.GetRequiredService<IWebRTCPeer>();
        }

        /// <summary>Starts the connection with the signaling server and waits for callers to connect over WebRTC.
        ///          Dependent on the services HttpClient, IRequestHandler.</summary>
        /// <version date="30.07.2025" sb="MAC">AKP-441 Created.</version>
        public async Task StartWebRTC()
        {
            // checks if requesthandler is registerd as a service.
            var _ = this.Services.GetRequiredService<IRequestHandler>();

            this.UserAgent.OnMessageReceived += this.HandleRequest;
            
            // TODO: Reconnect to the SIP server if it disconnects.
            await this.UserAgent.Connect();
        }

        private async Task HandleRequest(IWebRTCPeer sender, byte[] data)
        {
            if (!TryParseRootElement(data, out JsonDocument? rooteElement))
            {
                await BadRequest(sender, id: null);
                return;
            }

            if (!TryGetId(rooteElement, out string? id))
            {
                await BadRequest(sender, id: null);
                return;
            }

            if (!IdIsValid(id))
            {
                // TODO sent invalid ID?
                await BadRequest(sender, id: null);
                return;
            }

            if (!TryParseForChecksumCheck(rooteElement, out (JsonElement checkSum, JsonElement payload)? parsedRequest))
            {
                // cannot be parsed to check the checksum.
                await BadRequest(sender, id);
                return;
            }

            if (!ChecksumChecksOut(parsedRequest.Value.checkSum, parsedRequest.Value.payload))
            {
                await CheckSumError(sender, id);
                return;
            }

            if (!TryParseRequest(data, out WebRTCRequest? webRtcRequest))
            {
                // parsing error 
                await BadRequest(sender, id);
                return;
            }

            if (!RequestIsValid(webRtcRequest.Payload))
            {
                await BadRequest(sender, id);
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
                    Id = webRtcRequest.Id, // or just id variable? should be the same
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
                Timestamp = ((DateTimeOffset)DateTime.UtcNow).ToUnixTimeMilliseconds(),
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

        private static bool TryParseRequest(byte[] data, [NotNullWhen(true)] out WebRTCRequest? webRTCRequest)
        {
            string requestString = Encoding.UTF8.GetString(data);
            webRTCRequest = null;
            try
            {
                webRTCRequest = JsonSerializer.Deserialize<WebRTCRequest>(data, JsonOptions);
            }
            catch (JsonException)
            {
                return false;
            }

            if (webRTCRequest == null)
            {
                return false;
            }

            return true;
        }

        private static bool ChecksumChecksOut(JsonElement checkSum, JsonElement payload)
        {
            string checksumRawText = checkSum.ToString();
            byte[] sentChecksum;
            try
            {
                sentChecksum = Convert.FromBase64String(checksumRawText);
            }
            catch (FormatException)
            {
                // The checksum is not base64 encoded or there was an error in transmission.
                // TODO: bad request or checksumerror?
                // currently checksumerror
                return false;
            }

            byte[] calculatedChecksum = MD5.HashData(Encoding.UTF8.GetBytes(payload.GetRawText()));
            return sentChecksum.SequenceEqual(calculatedChecksum);
        }

        private static bool TryParseForChecksumCheck(JsonDocument request, [NotNullWhen(true)] out (JsonElement checkSum, JsonElement payload)? parsedRequest)
        {
            parsedRequest = null;

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

            parsedRequest = (checksum, payload);
            return true;
        }

        private static bool TryGetId(JsonDocument request, [NotNullWhen(true)] out string? id)
        {
            id = null;
            JsonElement IdElement;
            try
            {;
                IdElement = request.RootElement.GetProperty("id");
            }
            catch
            {
                return false;
            }

            if (IdElement.ValueKind != JsonValueKind.String)
            {
                // Id element is not a string
                return false;
            }

            id = IdElement.ToString();
            return true;
        }

        private static bool TryParseRootElement(byte[] data, [NotNullWhen(true)] out JsonDocument? rootElement)
        {
            rootElement = null;

            try
            {
                rootElement = JsonDocument.Parse(data, new JsonDocumentOptions() { AllowTrailingCommas = JsonOptions.AllowTrailingCommas });
            }
            catch (JsonException)
            {
                // TODO: parsing error. No id to tell the caller which request to resend
                return false;
            }

            return true;
        }

        private static bool IdIsValid(string id)
        {
            if (id.Length != 40)
            {
                return false;
            }

            string guid = id.Substring(0, 36);
            string sentChecksum = id.Substring(36);

            byte[] calculatedHash = MD5.HashData(Encoding.UTF8.GetBytes(guid));
            string calculatedChecksum = Encoding.UTF8.GetString(calculatedHash.Take(4).ToArray());

            return sentChecksum == calculatedChecksum;
        }
        
        private static bool RequestIsValid(WebRTCRequestPayload request)
        {
            if (request.Timestamp > ((DateTimeOffset)DateTime.UtcNow).ToUnixTimeMilliseconds()) // TODO also check if the request is expired (older than 10 min? what threshold?)
            {
                // a request from the future ?!? This must be important
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

        private static byte[] GetChecksum<T>(T payload)
        {
            string serializedPayload = JsonSerializer.Serialize(payload, JsonOptions);
            return  MD5.HashData(Encoding.UTF8.GetBytes(serializedPayload));
        }

        private static async Task CheckSumError(IWebRTCPeer sender, string id)
        {
            await ErrorResponse(sender, 422, id);
        }

        private static async Task BadRequest(IWebRTCPeer sender, string? id)
        {
            await ErrorResponse(sender, 400, id);
        }

        private static async Task ErrorResponse(IWebRTCPeer sender, short errorCode, string? id)
        {

            WebRTCErrorResponsePayload payload = new WebRTCErrorResponsePayload()
            {
                Timestamp = ((DateTimeOffset)DateTime.UtcNow).ToUnixTimeMilliseconds(),
                ErrorCode = errorCode,
            };

            WebRTCErrorResponse response = new WebRTCErrorResponse()
            {
                Id = id,
                Checksum = GetChecksum(payload),
                Payload = payload
            };

            await sender.SendMessageToPeer(JsonSerializer.Serialize(response, JsonOptions));
        }
    }
}
