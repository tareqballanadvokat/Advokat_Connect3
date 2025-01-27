//using System;
//using System.Net;
//using System.Net.Sockets;
//using System.Text;
//using System.Text.RegularExpressions;
//using SIPSorcery.Media;
//using SIPSorcery.Net;
//using SIPSorceryMedia.Encoders;
//using WebSocketSharp;
//using WebSocketSharp.Server;

//public class StunClient
//{
//    private const int WEBSOCKET_PORT = 8081;

//    static void Main()
//    {
//        Console.WriteLine("WebRTC Get Started");

//        // Start web socket.
//        Console.WriteLine("Starting web socket server...");
//        var webSocketServer = new WebSocketServer(IPAddress.Any, WEBSOCKET_PORT);
//        webSocketServer.AddWebSocketService<WebRTCWebSocketPeer>("/", (peer) => peer.CreatePeerConnection = () => CreatePeerConnection());
//        webSocketServer.Start();

//        Console.WriteLine($"Waiting for web socket connections on {webSocketServer.Address}:{webSocketServer.Port}...");

//        Console.WriteLine("Press any key exit.");
//        Console.ReadLine();
//    }

//    private static Task<RTCPeerConnection> CreatePeerConnection()
//    {
  
//        var pc = new RTCPeerConnection();
//        var testPatternSource = new VideoTestPatternSource(new VpxVideoEncoder());
//        //file transfer 
//        //pc.ondatachannel += (rdc) =>
//        //{
//        //    rdc.onopen += () => Console.WriteLine($"Data channel {rdc.label} opened.");
//        //    rdc.onclose += () => Console.WriteLine($"Data channel {rdc.label} closed.");
//        //    rdc.onmessage += (datachan, type, data) =>
//        //    {
//        //        switch (type)
//        //        {
//        //            case DataChannelPayloadProtocols.WebRTC_Binary_Empty:
//        //            case DataChannelPayloadProtocols.WebRTC_String_Empty:
//        //                Console.WriteLine($"Data channel {datachan.label} empty message type {type}.");
//        //                break;

//        //            case DataChannelPayloadProtocols.WebRTC_Binary:
//        //                string jsSha256 = data.ToString();// DoJavscriptSHA256(data);
//        //                Console.WriteLine($"Data channel {datachan.label} received {data.Length} bytes, js mirror sha256 {jsSha256}.");
//        //                rdc.send(jsSha256);

//        //                //if (_loadTestCount > 0)
//        //                //{
//        //                //    DoLoadTestIteration(rdc, _loadTestPayloadSize);
//        //                //    _loadTestCount--;
//        //                //}

//        //                break;

//        //            case DataChannelPayloadProtocols.WebRTC_String:
//        //                var msg = Encoding.UTF8.GetString(data);
//        //                Console.WriteLine($"Data channel {datachan.label} message {type} received: {msg}.");

//        //                var loadTestMatch = Regex.Match(msg, @"^\s*(?<sendSize>\d+)\s*x\s*(?<testCount>\d+)");

//        //                if (loadTestMatch.Success)
//        //                {
//        //                    uint sendSize = uint.Parse(loadTestMatch.Result("${sendSize}"));
//        //                    //_loadTestCount = int.Parse(loadTestMatch.Result("${testCount}"));
//        //                    //_loadTestCount = (_loadTestCount <= 0 || _loadTestCount > MAX_LOADTEST_COUNT) ? MAX_LOADTEST_COUNT : _loadTestCount;
//        //                    //_loadTestPayloadSize = (sendSize > pc.sctp.maxMessageSize) ? pc.sctp.maxMessageSize : sendSize;

//        //                    //logger.LogInformation($"Starting data channel binary load test, payload size {sendSize}, test count {_loadTestCount}.");
//        //                    //DoLoadTestIteration(rdc, _loadTestPayloadSize);
//        //                    //_loadTestCount--;
//        //                }
//        //                else
//        //                {
//        //                    // Do a string echo.
//        //                    rdc.send($"echo: {msg}");
//        //                }
//        //                break;
//        //        }
//        //    };
//        //};

//        //var dc = pc.createDataChannel("test", null);

//        //pc.onconnectionstatechange += (state) =>
//        //{
//        //    Console.WriteLine("DataChannel is open. Sending file...");

//        //    if (state == RTCPeerConnectionState.failed)
//        //    {
//        //        pc.Close("ice disconnection");
//        //    }
//        //};




//        //dataChannel.onopen += () =>
//        //{
//        //    Console.WriteLine("DataChannel is open. Sending file...");

//        //    // 4. Prześlij plik
//        //    string filePath = "example.txt";
//        //    if (File.Exists(filePath))
//        //    {
//        //        byte[] fileData = File.ReadAllBytes(filePath);
//        //        dataChannel.send(fileData);
//        //        Console.WriteLine("File sent!");
//        //    }
//        //    else
//        //    {
//        //        Console.WriteLine("File not found.");
//        //    }
//        //};




//        MediaStreamTrack videoTrack = new MediaStreamTrack(testPatternSource.GetVideoSourceFormats(), MediaStreamStatusEnum.SendOnly);
//        pc.addTrack(videoTrack);

//        testPatternSource.OnVideoSourceEncodedSample += pc.SendVideo;
//        pc.OnVideoFormatsNegotiated += (formats) => testPatternSource.SetVideoSourceFormat(formats.First());

//        pc.onconnectionstatechange += async (state) =>
//        {
//            Console.WriteLine($"Peer connection state change to {state}.");

//            switch (state)
//            {
//                case RTCPeerConnectionState.connected:
//                    await testPatternSource.StartVideo();
//                    break;
//                case RTCPeerConnectionState.failed:
//                    pc.Close("ice disconnection");
//                    break;
//                case RTCPeerConnectionState.closed:
//                    await testPatternSource.CloseVideo();
//                    testPatternSource.Dispose();
//                    break;
//            }
//        };

//        return Task.FromResult(pc);
//    }
//}
