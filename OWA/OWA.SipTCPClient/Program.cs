using System;
using System.Net;
using System.Threading.Tasks;
using SIPSorcery.SIP;
using SIPSorcery.SIP.App;

class SipClient
{
    private static SIPTransport _sipTransport;
    private static string serverIP = "92.205.233.81"; // Adres serwera SIP
    private static int serverPort = 80; // Port serwera SIP
    private static string user = "user1";
    private static string password = "password123";

    static async Task Main()
    {
        Console.WriteLine("Uruchamianie klienta SIP na TCP...");

        _sipTransport = new SIPTransport();

        try
        {
            // Konfiguracja klienta SIP na TCP
            var address = new IPEndPoint(IPAddress.Any, 0);
            var sipChannel = new SIPTCPChannel(address);
            _sipTransport.AddSIPChannel(sipChannel);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Błąd: {ex.Message}");
            return;
        }

        _sipTransport.SIPTransportResponseReceived += OnSipResponseReceived;

        await Register();
        await Task.Delay(2000); // Poczekaj na rejestrację
    //    await MakeCall();

        Console.WriteLine("Naciśnij ENTER, aby zakończyć...");
        Console.ReadLine();
    }

    private static async Task Register()
    {
        var uri = new SIPURI(user, serverIP, null);// { Transport = SIPProtocolsEnum.tcp }; // Ustawienie TCP

        var registerRequest = SIPRequest.GetRequest(SIPMethodsEnum.REGISTER, uri);
        var addressIP = new IPEndPoint(IPAddress.Parse(serverIP), 443).ToString();
        registerRequest.Header.From = new SIPFromHeader(user, new SIPURI(user, addressIP, null), null);
        registerRequest.Header.To = new SIPToHeader(user, new SIPURI(user, addressIP, null), null);
        registerRequest.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(user, addressIP, null)) };
        registerRequest.Header.CSeq = 1;
        // Poprawienie nagłówka Via, aby wymusić TCP

        var dd =   await _sipTransport.SendRequestAsync(registerRequest);
        Console.WriteLine("Wysłano żądanie rejestracji.");
    }

    //private static async Task MakeCall()
    //{
    //    var callUri = new SIPURI("user2", serverIP, null);
    //    var inviteRequest = SIPRequest.GetRequest(SIPMethodsEnum.INVITE, callUri);
    //    inviteRequest.Header.From = new SIPFromHeader(user, new SIPURI(user, serverIP, null), null);
    //    inviteRequest.Header.To = new SIPToHeader(null, callUri);
    //    inviteRequest.Header.Contact = new SIPContactHeader(null, new SIPURI(user, serverIP, null));
    //    inviteRequest.Header.CSeq = 1;

    //    await _sipTransport.SendRequestAsync(inviteRequest);
    //    Console.WriteLine("Wysłano INVITE.");
    //}

    private static Task OnSipResponseReceived(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
    {
        Console.WriteLine($"Otrzymano odpowiedź SIP: {sipResponse.StatusCode} {sipResponse.ReasonPhrase}");
        return Task.CompletedTask;
    }
}
