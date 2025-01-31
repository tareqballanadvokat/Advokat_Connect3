using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using SIPSorcery.Net;
using WebSocketSharp;

//Good discussion how to create multiple channesls
//https://groups.google.com/g/discuss-webrtc/c/uf4OGlod3DQ
class Program
{
    private const string STUN_URL = "stun1.l.google.com";
    private static RTCDataChannel _dataChannelDc1;
    private static RTCDataChannel _dataChannelDc2;
    private static Stopwatch sw1 = new Stopwatch();
    private static Stopwatch sw2 = new Stopwatch();

    static async Task Main(string[] args)
    {
        Func<Task<RTCPeerConnection>> createPeerConnection = async () =>
        {
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
         
            };
            var peerConnection = new RTCPeerConnection(config);


            //// Add Data Channel
            _dataChannelDc1 = await peerConnection.createDataChannel("dc1", new RTCDataChannelInit { id=1, negotiated = true });
            _dataChannelDc2 = await peerConnection.createDataChannel("asdsadas", new RTCDataChannelInit { id=232, negotiated = true });

            // Event Data Channel
            _dataChannelDc1.onopen += () =>
            {
                Console.WriteLine("Data Channel1 opened.");
                sw1.Stop();
                Console.WriteLine(sw1.ElapsedMilliseconds);


            };

            // Event Data Channel
            _dataChannelDc2.onopen += () =>
            {
                Console.WriteLine("Data Channel2 opened.");
                sw2.Stop();
                Console.WriteLine(sw2.ElapsedMilliseconds);
            };

            _dataChannelDc1.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                Console.WriteLine($"DC1 -Message recived: {System.Text.Encoding.UTF8.GetString(data)}");
            };

            _dataChannelDc2.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                Console.WriteLine($"DC2 -Message recived: {System.Text.Encoding.UTF8.GetString(data)}");
            };


            //_dataChannelDc1.onclose += () =>
            //{
            //    Console.WriteLine("Data Channel closed.");
            //};

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

        //NOT WORKING HERE - FIND BETTER SOLUTION
        //RTCConfiguration config = new RTCConfiguration
        //{
        //    iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
        //};
        //var peerConnection = new RTCPeerConnection(config);

        //_dataChannelDc1 = await peerConnection.createDataChannel("dc1");

        //_dataChannelDc1.onopen += () => Console.WriteLine("Opened DC1");
        //_dataChannelDc1.onclose += () => Console.WriteLine("Closed DC1");
        //_dataChannelDc1.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
        //{
        //    Console.WriteLine($"DC1 -Message recived: {System.Text.Encoding.UTF8.GetString(data)}");
        //};

        //_dataChannelDc2 = await peerConnection.createDataChannel("dc2");

        //_dataChannelDc2.onopen += () => Console.WriteLine("Opened DC2");
        //_dataChannelDc2.onclose += () => Console.WriteLine("Closed DC2");
        //_dataChannelDc2.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
        //{
        //    Console.WriteLine($"DC2 -Message recived: {System.Text.Encoding.UTF8.GetString(data)}");
        //};


        string webSocketServerUrl = "ws://92.205.233.81:8081/";
        sw1.Start();
        sw2.Start();
        var webSocketClient = new WebRTCWebSocketClient(webSocketServerUrl, createPeerConnection);
        await webSocketClient.Start(default);

        Console.WriteLine("Press any key.");
        Console.ReadKey();

        new Thread(() =>
        {
            SendFileAsyncDC1(@"C:\Projects\npp.8.7.4.Installer.x64.exe");
        }).Start();

        new Thread(() =>
        {
            SendFileAsyncDC2(@"C:\Projects\npp.8.7.4.Installer.x64.exe");
        }).Start();

        //await SendFileAsyncDC1(@"C:\Projects\npp.8.7.4.Installer.x64.exe");
        //await SendFileAsyncDC2(@"C:\Projects\npp.8.7.4.Installer.x64.exe");

        Console.WriteLine("Press any key to close.");
        Console.ReadKey();
    }

    private static async Task SendFileAsyncDC1(string filePath)
    {
        const int fragmentSize = 16000;

        if (_dataChannelDc1 == null || _dataChannelDc1.readyState != RTCDataChannelState.open)
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

                _dataChannelDc1.send(fragment);
                Console.WriteLine($"sent {i + 1}/{totalFragments}");
            }

            Console.WriteLine("File was closed");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{ex.Message}");
        }
    }

    private static async Task SendFileAsyncDC2(string filePath)
    {
        const int fragmentSize = 16000;

        if (_dataChannelDc2 == null || _dataChannelDc2.readyState != RTCDataChannelState.open)
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

                _dataChannelDc2.send(fragment);
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