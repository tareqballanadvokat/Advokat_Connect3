using SIPSorcery.SIP;
using WebRTCClient.Utils;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Models
{
    public class SignalingServerParams(
        SIPParticipant sourceParticipant,
        SIPParticipant remoteParticipant,
        SIPSchemesEnum sipScheme,
        HashSet<SIPClientChannelsEnum> sipChannels)
    {
        public SIPParticipant SourceParticipant { get; set; } = sourceParticipant;

        public SIPParticipant RemoteParticipant { get; set; } = remoteParticipant;

        public SIPSchemesEnum SIPScheme { get; set; } = sipScheme;

        public HashSet<SIPClientChannelsEnum> SIPChannels { get; set; } = sipChannels;
    }
}
