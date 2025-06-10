using SIPSorcery.SIP;

namespace WebRTCLibrary.SIP.Models
{
    public class SIPParticipant
    {
        public SIPParticipant(string name, SIPEndPoint Endpoint)
        {
            Name = name;
            this.Endpoint = Endpoint;
        }

        public string Name { get; set; }

        public SIPEndPoint Endpoint { get; set; }

        public override string ToString()
        {
            return $"\"{this.Name}\" {this.Endpoint}";
        }
    }
}
