using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    // Używamy jednej instancji UdpClient do wysyłania i odbioru
    static UdpClient udpClient;
    static IPEndPoint serverEndPoint;

    static async Task Main(string[] args)
    {
        Console.WriteLine("Starting SIP Real Client ...");

        //Console.WriteLine("Type SIP IP address (np. 92.205.233.81):");
        string serverIp = "92.205.233.81";// Console.ReadLine();
        serverEndPoint = new IPEndPoint(IPAddress.Parse(serverIp), 8081);

        // Konfiguracja lokalnego portu
        Console.WriteLine("Choose Local Port  (np. 5061):");
        int clientPort = int.Parse(Console.ReadLine());

        var hostAddresses = Dns.GetHostAddresses(Dns.GetHostName());
        for (int i = 0; i < hostAddresses.Length; i++)
        {
            Console.WriteLine($"[{i}] - {hostAddresses[i]}");
        }
        Console.WriteLine("Choose IP:");
        int ipIndex = int.Parse(Console.ReadLine());
        IPAddress localIP = hostAddresses[ipIndex];
        IPEndPoint localEndPoint = new IPEndPoint(localIP, clientPort);
        Console.WriteLine($"Your IP: {localEndPoint}");

        Console.WriteLine("Your ID(np. xyz123):");
        string fromName = Console.ReadLine();
        Console.WriteLine("Destination ID (np. asd123):");
        string toName = Console.ReadLine();

        udpClient = new UdpClient(localEndPoint);

        CancellationTokenSource cts = new CancellationTokenSource();
        Task listeningTask = Task.Run(() => ListenForMessages(cts.Token));

        int cseq = 1;


        // 1. SIP REGISTER
        string registerMessage = CreateSIPMessage("REGISTER", fromName, toName, localEndPoint, $"{serverIp}:{serverPort}", cseq++, "");
        await SendSIPMessage(registerMessage);
        Console.WriteLine("SIP REGISTER sent.");

        // 2. SIP INVITE
        string inviteBody = "Inviting";
        string inviteMessage = CreateSIPMessage("INVITE", fromName, toName, localEndPoint, $"{serverIp}:{serverPort}", cseq++, inviteBody);
        await SendSIPMessage(inviteMessage);
        Console.WriteLine("SIP INVITE sent.");

        // 3. SIP PUBLISH
        string publishBody = "MyOffer";
        string publishMessage = CreateSIPMessage("PUBLISH", fromName, toName, localEndPoint, $"{serverIp}:{serverPort}", cseq++, publishBody);
        await SendSIPMessage(publishMessage);
        Console.WriteLine("SIP PUBLISH sent.");

        bool isActive = true;
        while (isActive)
        {
            Console.WriteLine("Wpisz wiadomość do wysłania:");
            string userMessage = Console.ReadLine();
            string messageMessage = CreateSIPMessage("MESSAGE", fromName, toName, localEndPoint, $"{serverIp}:{serverPort}", cseq++, userMessage);
            await SendSIPMessage(messageMessage);
            Console.WriteLine("SIP MESSAGE sent.");

            Console.WriteLine("Czy chcesz wysłać kolejną wiadomość? [Y/N]");
            string answer = Console.ReadLine();
            if (answer.Trim().ToUpper() == "N")
            {
                isActive = false;
                // 5. SIP BYE
                string byeMessage = CreateSIPMessage("BYE", fromName, toName, localEndPoint, $"{serverIp}:{serverPort}", cseq++, "BYE message");
                await SendSIPMessage(byeMessage);
                Console.WriteLine("SIP BYE sent.");
            }
        }

        Console.ReadKey();
        cts.Cancel();
    }

    static string CreateSIPMessage(string method, string fromName, string toName, IPEndPoint localEndPoint, string serverAddress, int cseq, string body)
    {
        string callId = Guid.NewGuid().ToString();
        string branch = "z9hG4bK-" + new Random().Next(1000, 9999).ToString();

        // Request-Line: np. "REGISTER sip:92.205.233.81:8081 SIP/2.0"
        string requestLine = $"{method} sip:{serverAddress} SIP/2.0";
        // Via: podajemy lokalny adres i port oraz branch
        string via = $"Via: SIP/2.0/UDP {localEndPoint.Address}:{localEndPoint.Port};branch={branch}";
        string maxForwards = "Max-Forwards: 70";
        string fromHeader = $"From: <sip:{fromName}@{localEndPoint.Address}>;tag=client";
        string toHeader = $"To: <sip:{toName}@{serverAddress}>";
        string cSeqHeader = $"CSeq: {cseq} {method}";
        string callIdHeader = $"Call-ID: {callId}";
        string contactHeader = $"Contact: <sip:{fromName}@{localEndPoint.Address}:{localEndPoint.Port}>";
        int contentLength = string.IsNullOrEmpty(body) ? 0 : Encoding.ASCII.GetByteCount(body);
        string contentLengthHeader = $"Content-Length: {contentLength}";

        string sipMessage = $"{requestLine}\r\n" +
                            $"{via}\r\n" +
                            $"{maxForwards}\r\n" +
                            $"{fromHeader}\r\n" +
                            $"{toHeader}\r\n" +
                            $"{callIdHeader}\r\n" +
                            $"{cSeqHeader}\r\n" +
                            $"{contactHeader}\r\n" +
                            $"{contentLengthHeader}\r\n\r\n" +
                            $"{body}";
        return sipMessage;
    }

    static async Task SendSIPMessage(string message)
    {
        byte[] bytes = Encoding.ASCII.GetBytes(message);
        await udpClient.SendAsync(bytes, bytes.Length, serverEndPoint);
    }

    static async Task ListenForMessages(CancellationToken token)
    {
        try
        {
            while (!token.IsCancellationRequested)
            {
                UdpReceiveResult result = await udpClient.ReceiveAsync();
                string received = Encoding.ASCII.GetString(result.Buffer);
                Console.WriteLine("Recived SIP message:");
                Console.WriteLine(received);
            }
        }
        catch (ObjectDisposedException)
        {
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error:" + ex.Message);
        }
    }
}