using System;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using SIPSorcery.Net;
using WebSocketSharp;

class Program
{
 
    private const string STUN_URL = "stun1.l.google.com"; 
    private static RTCDataChannel _dataChannel;

    static async Task Main(string[] args)
    {
        Func<Task<RTCPeerConnection>> createPeerConnection = async () =>
        {
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
            };
            var peerConnection = new RTCPeerConnection(config);


            // Add Data Channel
            _dataChannel = await peerConnection.createDataChannel("dc1");

            // Event Data Channel
            _dataChannel.onopen += () =>
            {
                Console.WriteLine("Data Channel opened.");
                // Send data by Data Channel

                //var dataToSend = System.IO.File.ReadAllBytes(@"C:\Projects\npp.8.7.4.Installer.x64.exe");

                //_dataChannel.send(" ADVOKAT.AT");
                //var dd = dataToSend.Chunk((int)SCTP_DEFAULT_MAX_MESSAGE_SIZE);
                //foreach (var d in dd)
                //{
                //    _dataChannel.send(d);
                //}


            };

            _dataChannel.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                Console.WriteLine($"Message recived: {System.Text.Encoding.UTF8.GetString(data)}");
            };

            _dataChannel.onclose += () =>
            {
                Console.WriteLine("Data Channel closed.");
            };

            // ICE Candidates
            peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
            {
                if (candidate != null)
                {
                    Console.WriteLine($"New ICE Candidate: {candidate.candidate}");
                }
                else
                {
                    Console.WriteLine("All ICE Candidates generated");
                }
            };

            return peerConnection;
        };
         
        RTCConfiguration config = new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
        };
        var peerConnection = new RTCPeerConnection(config);
         
        _dataChannel = await peerConnection.createDataChannel("dc1");
         
        _dataChannel.onopen += () => Console.WriteLine("Opened");
        _dataChannel.onclose += () => Console.WriteLine("Closed"); 
        _dataChannel.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
        {
            Console.WriteLine($"Message recived: {System.Text.Encoding.UTF8.GetString(data)}");
        };
         
        string webSocketServerUrl = "ws://92.205.233.81:8081/";

        var webSocketClient = new WebRTCWebSocketClient(webSocketServerUrl, createPeerConnection);
        await webSocketClient.Start(default);
         
        Console.WriteLine("Press any key.");
        Console.ReadKey();
        await SendFileAsync(@"C:\Projects\npp.8.7.4.Installer.x64.exe");

        Console.WriteLine("Press any key to close.");
        Console.ReadKey();
    }

    private static async Task SendFileAsync(string filePath)
    {
        const int fragmentSize = 16000; 

        if (_dataChannel == null || _dataChannel.readyState != RTCDataChannelState.open)
        {
            Console.WriteLine("DC is closed");
            return;
        }

        try
        {
            byte[] fileBytes = await File.ReadAllBytesAsync(filePath);
            int totalFragments = (int)Math.Ceiling((double)fileBytes.Length / fragmentSize);

            for (int i = 0; i < totalFragments; i++)
            {
                int offset = i * fragmentSize;
                int size = Math.Min(fragmentSize, fileBytes.Length - offset);
                byte[] fragment = new byte[size];
                Array.Copy(fileBytes, offset, fragment, 0, size);

                _dataChannel.send(fragment);
                Console.WriteLine($"sent {i + 1}/{totalFragments}");
            }

            Console.WriteLine("File was closed");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{ex.Message}");
        }
    }
}