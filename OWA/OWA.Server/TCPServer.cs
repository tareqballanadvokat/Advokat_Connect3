//using System;
//using System.Collections.Concurrent;
//using System.Net;
//using System.Net.Sockets;
//using System.Text;
//using System.Threading.Tasks;
//using SIPSorcery.SIP;
//using SIPSorcery.SIP.App;

//namespace SipSignalServer
//{
//    class Program
//    {
//        static ConcurrentDictionary<string, SIPURI> registeredUsers = new();
//        static SIPTransport sipTransport;


//        private static TcpListener listener;
//        private const int port = 80;


//        static async Task Main(string[] args)
//        {
//            Console.WriteLine("Starting SIP Server...");

//            //IPAddress listenAddress = IPAddress.Any;
//            //int listenPort = 5060;
//            //sipTransport = new SIPTransport();


//            var ips = Dns.GetHostAddresses(Dns.GetHostName());
//            IPAddress listenAddress = ips[2];// IPAddress.Any;
//            int listenPort = 80;
//            //int listenPort = 80;
//            //int listenPort = 5060;
//            //      sipTransport = new SIPTransport();















//            try
//            {


//                Console.WriteLine($"SIP Server listening on {listenAddress}:{listenPort}");





//                try
//                {
//                    listener = new TcpListener(IPAddress.Any, port);
//                    listener.Start();
//                    Console.WriteLine($"Serwer nasłuchuje na porcie {port}...");

//                    while (true)
//                    {
//                        TcpClient client = listener.AcceptTcpClient();
//                        Console.WriteLine("Nowe połączenie!");

//                        // Obsługa klienta w osobnym wątku
//                        Thread clientThread = new Thread(HandleClient);
//                        clientThread.Start(client);
//                    }
//                }
//                catch (Exception ex)
//                {
//                    Console.WriteLine($"Błąd: {ex.Message}");
//                }
//                finally
//                {
//                    listener?.Stop();
//                }



//                await Task.Delay(-1);
//            }
//            catch (Exception ex)
//            {
//                Console.WriteLine($"Error: {ex.Message}");
//            }
//            finally
//            {
//                sipTransport.Shutdown();
//            }
//        }


//        private static void HandleClient(object obj)
//        {
//            TcpClient client = (TcpClient)obj;
//            NetworkStream stream = client.GetStream();
//            byte[] buffer = new byte[1024];
//            int bytesRead;

//            try
//            {
//                while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
//                {
//                    string receivedMessage = Encoding.UTF8.GetString(buffer, 0, bytesRead);
//                    Console.WriteLine($"Otrzymano: {receivedMessage}");

//                    // Odpowiedź do klienta
//                    string response = $"Serwer otrzymał: {receivedMessage}";
//                    byte[] responseBytes = Encoding.UTF8.GetBytes(response);
//                    stream.Write(responseBytes, 0, responseBytes.Length);
//                }
//            }
//            catch (Exception ex)
//            {
//                Console.WriteLine($"Błąd klienta: {ex.Message}");
//            }
//            finally
//            {
//                client.Close();
//                Console.WriteLine("Klient rozłączony.");
//            }
//        }
//    }
//}