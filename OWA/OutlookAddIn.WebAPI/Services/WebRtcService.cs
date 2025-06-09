using SIPSorcery.Net;

namespace OutlookAddIn.WebAPI.Services
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Net;
    using System.Threading;
    using System.Threading.Tasks;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Logging.Abstractions;
 
    using SIPSorcery.Media;
    using SIPSorcery.Net;
    using SIPSorceryMedia.Encoders;
    using WebSocketSharp.Server;
    public class WebRtcService : BackgroundService
    {
        private readonly ILogger<WebRtcService> _logger;
        private WebSocketServer _webSocketServer;
        private const int WEBSOCKET_PORT = 8081;
        private const string STUN_URL = "stun:stun.sipsorcery.com";

        public WebRtcService(ILogger<WebRtcService> logger)
        {
            _logger = logger;
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Starting WebRTC WebSocket server...");
            _webSocketServer = new WebSocketServer(IPAddress.Any, WEBSOCKET_PORT);
            _webSocketServer.AddWebSocketService<WebRTCWebSocketPeer>("/", peer =>
            {
                peer.CreatePeerConnection = CreatePeerConnection;
                WebSocketPeerManager.ConnectedPeers.Add(peer);
            });
            _webSocketServer.Start();
            _logger.LogInformation("WebRTC WebSocket server started on ws://*:8081");

            return Task.CompletedTask;
        }

        public override Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Stopping WebRTC WebSocket server...");
            _webSocketServer?.Stop();
            return base.StopAsync(cancellationToken);
        }

        private Task<RTCPeerConnection> CreatePeerConnection()
        {
            var config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
            };

            var pc = new RTCPeerConnection(config);

            var videoSource = new VideoTestPatternSource();
            var videoEncoder = new VideoEncoderEndPoint();
            var audioSource = new AudioExtrasSource(new AudioEncoder(), new AudioSourceOptions { AudioSource = AudioSourcesEnum.Music });

            var videoTrack = new MediaStreamTrack(videoEncoder.GetVideoSourceFormats(), MediaStreamStatusEnum.SendRecv);
            var audioTrack = new MediaStreamTrack(audioSource.GetAudioSourceFormats(), MediaStreamStatusEnum.SendRecv);

            pc.addTrack(videoTrack);
            pc.addTrack(audioTrack);

            videoSource.OnVideoSourceRawSample += videoEncoder.ExternalVideoSourceRawSample;
            videoEncoder.OnVideoSourceEncodedSample += pc.SendVideo;
            audioSource.OnAudioSourceEncodedSample += pc.SendAudio;

            pc.OnVideoFormatsNegotiated += formats => videoEncoder.SetVideoSourceFormat(formats.First());
            pc.OnAudioFormatsNegotiated += formats => audioSource.SetAudioSourceFormat(formats.First());

            pc.onconnectionstatechange += async state =>
            {
                _logger.LogInformation($"WebRTC connection state: {state}");
                if (state == RTCPeerConnectionState.connected)
                {
                    await audioSource.StartAudio();
                    await videoSource.StartVideo();
                }
                else if (state == RTCPeerConnectionState.closed || state == RTCPeerConnectionState.failed)
                {
                    await audioSource.CloseAudio();
                    await videoSource.CloseVideo();
                }
            };

            return Task.FromResult(pc);
        }
    }

}



public static class WebSocketPeerManager
{
    public static List<WebRTCWebSocketPeer> ConnectedPeers { get; } = new();
}