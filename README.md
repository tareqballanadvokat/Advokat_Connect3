# ADVOKAT_Connect

needed library: https://github.com/sipsorcery-org/sipsorcery
it can be used as nuget package, but is here commited with source code for researching purpose

- OWA.Client - c# client based on SipSorcery library 
- OWA.ClientCustomWS - WebRTC based on SipSorcery with custom Wev Service for sending messages. NOT WORKING PROPERLY (for better understanding approach)
- OWA.ClientJS - html + js for communication with server
- OWA.Server - Server based on SipSorcery
- OWA.ClientSendingFile
- OWA.SignallingServer - project for PoC based on signalling erver implementated in SipSorcery 
- OWA.SignallingClient - project for connecting to the Signalling server


- OWA.TCPServer - project for connecting TCP:80 connection - basic TCPClient listener made
- OWA.TCPClient - project for connecting on TCP:80 


- OWA.SipTCPServer - project for connecting via TCP connection based on SIPSorcery library
- OWA.SipTCPClient - project for connecting via TCP connection based on SIPSorcery library


- OWA.SignallingServer -Sip SERVER based on UDP port 8081 which receives massegaes - 
- OWA.SignallingClientMultiCommunicaton - based on UDP:8081 client in SipSorcery 
- OWA.SipUDPClient - another one project for connecting on UDP:8081 in C# only