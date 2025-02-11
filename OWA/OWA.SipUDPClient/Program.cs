using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    static UdpClient udpClient;
    static IPEndPoint serverEndPoint;
    public static List<int> requestResponseList = new List<int>();

    static async Task Main(string[] args)
    {
        Console.WriteLine("Starting Basic SIP Client");

        Console.WriteLine("SIP SERVER hardcoded address: 92.205.233.81");
        Console.WriteLine(Environment.NewLine + "Please type SIP SERVER PORT (if empty default: 8081)");
        string serverIp = "92.205.233.81";// Console.ReadLine();
        string serverPort = Console.ReadLine();
        var parsed = int.TryParse(serverPort, out int port);
        if (parsed == false) { port = 8081; }
        serverEndPoint = new IPEndPoint(IPAddress.Parse(serverIp), port);

        Console.WriteLine("Type Your Local opened UDP Port (ex. 5061):");
        int clientPort = int.Parse(Console.ReadLine());

        var hostAddresses = Dns.GetHostAddresses(Dns.GetHostName());
        for (int i = 0; i < hostAddresses.Length; i++)
        {
            Console.WriteLine($"[{i}] - {hostAddresses[i]}");
        }
        Console.WriteLine("Choose IP from list:");
        int ipIndex = int.Parse(Console.ReadLine());
        IPAddress localIP = hostAddresses[ipIndex];
        IPEndPoint localEndPoint = new IPEndPoint(localIP, clientPort);
        string fromName = "client1";// Console.ReadLine(); 
        string toName = "server1";// Console.ReadLine();


        udpClient = new UdpClient(localEndPoint);


        CancellationTokenSource cts = new CancellationTokenSource();
        Task listeningTask = Task.Run(() => ListenForMessages(cts.Token));

        Console.WriteLine(Environment.NewLine+"SIP Server started. - " + serverEndPoint);
        Console.WriteLine("UDP Client started. - "+ localEndPoint);
        int cseq = 1;
        // 1. SIP REGISTER
        string registerMessage = CreateSIPMessage("REGISTER", fromName, toName, localEndPoint, $"{serverIp}:{serverPort}", cseq++, "");
        await SendSIPMessage(registerMessage);
        Console.WriteLine(Environment.NewLine +"SIP REGISTER message sent.");

        new Thread(async () =>
        {
            Task.Delay(10000).Wait();
            CheckConnectionStatus();
        }).Start();

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



        Console.ReadKey();
        cts.Cancel();
        udpClient?.Close();
        udpClient?.Dispose();
    }

    public static void CheckConnectionStatus()
    {
        if (requestResponseList.Where(x => x == 1).Any())
        {
            Console.WriteLine($"CONNECTION ESTABLISHED");
            return;
        }

        Console.WriteLine($"CONNECTION NOT ESTABLISHED");
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
               var splittedBuffer = received.Split(Environment.NewLine);
                requestResponseList.Add(1);
                Console.WriteLine("Recived SIP message from SERVER:");
                foreach (var item in splittedBuffer)
                {
                Console.WriteLine("  "+item);

                }
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