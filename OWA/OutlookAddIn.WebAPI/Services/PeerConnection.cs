using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions; 
using SIPSorcery.Net; 
using WebSocketSharp.Server;

namespace OutlookAddIn.WebAPI.Services
{
 
    public class PeerConnection : IPeerConnection
    {
        private const int WEBSOCKET_PORT = 8081;
        private const string STUN_URL = "stun:stun.sipsorcery.com";
        private static Microsoft.Extensions.Logging.ILogger logger = NullLogger.Instance;

        public Task<RTCPeerConnection> Start()
        {
            var webSocketServer = new WebSocketServer(IPAddress.Any, WEBSOCKET_PORT);

            // 1. Stwórz instancję RTCPeerConnection
            var rtcPeerConnection = CreatePeerConnection();

            // 2. Przypisz ją do serwisu WebSocket
            webSocketServer.AddWebSocketService<WebRTCWebSocketPeer>("/", (peer) =>
            {
                peer.CreatePeerConnection = () => rtcPeerConnection;
            });

            webSocketServer.Start();

            // 3. Zwróć jako Task
            return rtcPeerConnection;
        }


        private static Task<RTCPeerConnection> CreatePeerConnection()
        {
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } },
                //X_BindAddress = IPAddress.Any
            };
            var pc = new RTCPeerConnection(config);

            //var testPatternSource = new VideoTestPatternSource();
            //var videoEncoderEndPoint = new VideoEncoderEndPoint();
            //var audioSource = new AudioExtrasSource(new AudioEncoder(), new AudioSourceOptions { AudioSource = AudioSourcesEnum.Music });

            //MediaStreamTrack videoTrack = new MediaStreamTrack(videoEncoderEndPoint.GetVideoSourceFormats(), MediaStreamStatusEnum.SendRecv);
            //pc.addTrack(videoTrack);
            //MediaStreamTrack audioTrack = new MediaStreamTrack(audioSource.GetAudioSourceFormats(), MediaStreamStatusEnum.SendRecv);
            //pc.addTrack(audioTrack);

            //testPatternSource.OnVideoSourceRawSample += videoEncoderEndPoint.ExternalVideoSourceRawSample;
            //videoEncoderEndPoint.OnVideoSourceEncodedSample += pc.SendVideo;
            //audioSource.OnAudioSourceEncodedSample += pc.SendAudio;

            //pc.OnVideoFormatsNegotiated += (formats) => videoEncoderEndPoint.SetVideoSourceFormat(formats.First());
            //pc.OnAudioFormatsNegotiated += (formats) => audioSource.SetAudioSourceFormat(formats.First());
            pc.onsignalingstatechange += () =>
            {
                logger.LogDebug($"Signalling state change to {pc.signalingState}.");

                if (pc.signalingState == RTCSignalingState.have_local_offer)
                {
                    logger.LogDebug($"Local SDP offer:\n{pc.localDescription.sdp}");
                }
                else if (pc.signalingState == RTCSignalingState.stable)
                {
                     logger.LogDebug($"Remote SDP offer:\n{pc.remoteDescription.sdp}");
                }
            };

            pc.onconnectionstatechange += async (state) =>
            {
               // logger.LogDebug($"Peer connection state change to {state}.");

                if (state == RTCPeerConnectionState.connected)
                {
                    //await audioSource.StartAudio();
                    //await testPatternSource.StartVideo();
                }
                else if (state == RTCPeerConnectionState.failed)
                {
                    pc.Close("ice disconnection");
                }
                else if (state == RTCPeerConnectionState.closed)
                {
                    //await testPatternSource.CloseVideo();
                    //await audioSource.CloseAudio();
                }
            };

            //// Diagnostics.
            //pc.OnReceiveReport += (re, media, rr) => logger.LogDebug($"RTCP Receive for {media} from {re}\n{rr.GetDebugSummary()}");
            //pc.OnSendReport += (media, sr) => logger.LogDebug($"RTCP Send for {media}\n{sr.GetDebugSummary()}");
            //pc.GetRtpChannel().OnStunMessageReceived += (msg, ep, isRelay) => logger.LogDebug($"STUN {msg.Header.MessageType} received from {ep}.");
            //pc.oniceconnectionstatechange += (state) => logger.LogDebug($"ICE connection state change to {state}.");


            return Task.FromResult(pc);
        }

    }
}
