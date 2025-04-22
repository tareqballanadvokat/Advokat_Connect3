using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Models
{
    public class SignalingServerParams
    {
        public SignalingServerParams(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            SIPSchemesEnum sipScheme,
            IEnumerable<SIPChannelsEnum> sipChannels
            )
        {
            this.SourceParticipant = sourceParticipant;
            this.RemoteParticipant = remoteParticipant;
            this.SIPScheme = sipScheme;

            foreach (SIPChannelsEnum sipChannel in sipChannels)
            {
                this.SIPChannels.Add(sipChannel);
            }
        }

        public SIPParticipant SourceParticipant { get; set; }

        public SIPParticipant RemoteParticipant { get; set; }

        public SIPSchemesEnum SIPScheme { get; set; }

        public HashSet<SIPChannelsEnum> SIPChannels { get; set; } = new HashSet<SIPChannelsEnum>();
    }
}
