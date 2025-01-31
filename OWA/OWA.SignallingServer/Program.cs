using System;
using System.Net;
using System.Threading.Tasks;
using SIPSorcery.SIP;
using SIPSorcery.SIP.App;

namespace SipSignalServer
{
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.WriteLine("Starting SIP Server...");

            // Konfiguracja adresu serwera
            IPAddress listenAddress = IPAddress.Any;
            int listenPort = 5060;
            var sipTransport = new SIPTransport();

            try
            {
                // Konfiguracja SIP Transport (UDP, TCP, TLS)
                sipTransport.AddSIPChannel(new SIPUDPChannel(new IPEndPoint(listenAddress, listenPort)));

                // Obsługa wiadomości SIP
                sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequest) =>
                {
                    Console.WriteLine($"Received SIP request: {sipRequest.Method} from {remoteEndPoint} with data: {sipRequest.Body}");
                    

                    if (sipRequest.Method == SIPMethodsEnum.REGISTER)
                    {
                        var response = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
                        await sipTransport.SendResponseAsync(response);
                        Console.WriteLine("SIP Registration OK");
                    }
                    else if (sipRequest.Method == SIPMethodsEnum.INVITE)
                    {
                        var tryingResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Trying, null);
                        await sipTransport.SendResponseAsync(tryingResponse);

                        var ringingResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ringing, null);
                        await sipTransport.SendResponseAsync(ringingResponse);

                        var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, "TEst returned from Signallin server");
                        okResponse.Body = "Body retuned form signalling server";
                        await sipTransport.SendResponseAsync(okResponse);
                        Console.WriteLine("Call established");
                    }
                    else
                    {
                        var notAllowedResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.MethodNotAllowed, null);
                        await sipTransport.SendResponseAsync(notAllowedResponse);
                    }
                };

                Console.WriteLine($"SIP Server listening on {listenAddress}:{listenPort}");

                await Task.Delay(-1); // Keep the server running
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
            finally
            {
                sipTransport.Shutdown();
            }
        }
    }
}
