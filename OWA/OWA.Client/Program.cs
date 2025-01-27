//using System;
//using System.IO;
//using System.Text;
//using System.Threading.Tasks;
//using SIPSorcery.Net;
//using SIPSorceryMedia.Abstractions;

//class Program
//{
//    static async Task Main(string[] args)
//    {
//        Console.WriteLine("WebRTC Server with DataChannel file transfer");

//        // Stwórz RTCPeerConnection
//        var peerConnection = new RTCPeerConnection();

//        // Utwórz DataChannel
//        var dataChannel = await  peerConnection.createDataChannel("fileTransfer");
//        dataChannel.onopen += () =>
//        {
//            Console.WriteLine("DataChannel opened.");
//            SendFile(dataChannel, "example.txt"); // Wysyłanie pliku
//        };

//        dataChannel.onmessage += 

//        //Obsłuż połączenie SDP(od peerów)
//        peerConnection.OnReceiveOffer += async (rtcSessionDescription) =>
//        {
//            Console.WriteLine("Received SDP offer");
//            await peerConnection.setRemoteDescription(rtcSessionDescription);
//            var answer = await peerConnection.createAnswer();
//            await peerConnection.setLocalDescription(answer);

//            // Wyświetl odpowiedź SDP, którą należy przesłać do klienta
//            Console.WriteLine("SDP Answer:");
//            Console.WriteLine(answer.sdp);
//        };

//        // Obsługa ICE Candidate
//        peerConnection.onicecandidate += (candidate) =>
//        {
//            if (candidate != null)
//            {
//                Console.WriteLine($"ICE Candidate: {candidate.candidate}");
//            }
//        };

//        Console.WriteLine("Server ready. Awaiting WebRTC connections...");
//        Console.ReadLine();
//    }

//    private static void SendFile(RTCDataChannel dataChannel, string filePath)
//    {
//        if (!File.Exists(filePath))
//        {
//            Console.WriteLine($"File {filePath} not found.");
//            return;
//        }

//        var fileBytes = File.ReadAllBytes(filePath);
//        const int chunkSize = 16384; // 16KB, max dla WebRTC DataChannel
//        int totalChunks = (int)Math.Ceiling((double)fileBytes.Length / chunkSize);

//        Console.WriteLine($"Sending file {filePath}, size {fileBytes.Length} bytes in {totalChunks} chunks.");

//        for (int i = 0; i < totalChunks; i++)
//        {
//            int offset = i * chunkSize;
//            int size = Math.Min(chunkSize, fileBytes.Length - offset);
//            var chunk = new byte[size];
//            Array.Copy(fileBytes, offset, chunk, 0, size);

//            dataChannel.send(chunk);
//            Console.WriteLine($"Sent chunk {i + 1}/{totalChunks}");
//        }

//        Console.WriteLine("File transfer completed.");
//    }
//}
