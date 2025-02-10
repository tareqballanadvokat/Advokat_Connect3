using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    // Używamy jednej instancji UdpClient do wysyłania i odbioru
    static TcpClient tcpClient;
    static IPEndPoint serverEndPoint;
    public static List<int> requestResponseList = new List<int>();

    static async Task Main(string[] args)
    {
        Console.WriteLine("Starting Basic SIP Client");

        Console.WriteLine("SIP SERVER address: 92.205.233.81");
        Console.WriteLine(Environment.NewLine + "Please type SIP SERVER PORT (if empty default: 80)");
        string serverIp = "92.205.233.81";// Console.ReadLine();
        string serverPort = Console.ReadLine();
        var parsed = int.TryParse(serverPort, out int port);
        if (parsed == false) { port = 80; }
        serverEndPoint = new IPEndPoint(IPAddress.Parse(serverIp), port);

 

        tcpClient = new TcpClient(serverIp, port);




        NetworkStream nwStream = tcpClient.GetStream();
        byte[] bytesToSend = ASCIIEncoding.ASCII.GetBytes("sdasd");

        //---send the text---
        Console.WriteLine("Sending : " + "textToSend");
        nwStream.Write(bytesToSend, 0, bytesToSend.Length);

        //---read back the text---
        byte[] bytesToRead = new byte[tcpClient.ReceiveBufferSize];
        int bytesRead = nwStream.Read(bytesToRead, 0, tcpClient.ReceiveBufferSize);
        Console.WriteLine("Received : " + Encoding.ASCII.GetString(bytesToRead, 0, bytesRead));
        Console.ReadLine();
        tcpClient.Close();



 

 



        Console.ReadKey();
 

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

 
  
}