using SIPSorcery.SIP;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace WebRTCCallerLibrary.Utils
{
    public class SIPParticipant
    {
        public SIPParticipant(string name, SIPEndPoint Endpoint)
        {
            this.Name = name;
            this.Endpoint = Endpoint;
        }

        public string Name { get; set; }

        public SIPEndPoint Endpoint { get; set; }
    }
}
