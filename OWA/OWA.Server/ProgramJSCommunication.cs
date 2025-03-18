//using System.Net.WebSockets;
//using System.Text;
//using Microsoft.AspNetCore.Builder;
//using Microsoft.AspNetCore.Http;

//var builder = WebApplication.CreateBuilder(args);
//var app = builder.Build();

//var webSocketConnections = new List<WebSocket>();

//app.UseWebSockets();
//app.Map("/ws", async context =>
//{
//    if (context.WebSockets.IsWebSocketRequest)
//    {
//        var webSocket = await context.WebSockets.AcceptWebSocketAsync();
//        webSocketConnections.Add(webSocket);

//        var buffer = new byte[1024 * 4];
//        WebSocketReceiveResult result;
//        do
//        {
//            result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
//            var message = Encoding.UTF8.GetString(buffer, 0, result.Count);

//            // Broadcast to all connected clients
//            foreach (var socket in webSocketConnections)
//            {
//                if (socket != webSocket && socket.State == WebSocketState.Open)
//                {
//                    await socket.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(message)), WebSocketMessageType.Text, true, CancellationToken.None);
//                }
//            }
//        } while (!result.CloseStatus.HasValue);

//        webSocketConnections.Remove(webSocket);
//        await webSocket.CloseAsync(result.CloseStatus.Value, result.CloseStatusDescription, CancellationToken.None);
//    }
//    else
//    {
//        context.Response.StatusCode = StatusCodes.Status400BadRequest;
//    }
//});

//app.Run("http://localhost:5000");
