using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;


var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var clients = new ConcurrentDictionary<string, WebSocket>();

app.UseWebSockets();
app.Map("/sip", async context =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        var clientId = context.Connection.Id;
        clients[clientId] = webSocket;

        var buffer = new byte[1024 * 4];
        WebSocketReceiveResult result;
        do
        {
            result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            Console.WriteLine($"Received from {clientId}: {message}");

            // Handle SIP message types
            if (message.StartsWith("REGISTER"))
            {
                await webSocket.SendAsync(Encoding.UTF8.GetBytes("200 OK: Registered"), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            else if (message.StartsWith("MESSAGE"))
            {
                // Broadcast message to all clients
                foreach (var client in clients.Values)
                {
                    if (client.State == WebSocketState.Open)
                    {
                        await client.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(message)), WebSocketMessageType.Text, true, CancellationToken.None);
                    }
                }
            }
            else if (message.StartsWith("NOTIFY"))
            {
                foreach (var client in clients.Values)
                {
                    if (client.State == WebSocketState.Open && client != webSocket)
                    {
                        await client.SendAsync(Encoding.UTF8.GetBytes("NOTIFY received"), WebSocketMessageType.Text, true, CancellationToken.None);
                    }
                }
            }
        } while (!result.CloseStatus.HasValue);

        clients.TryRemove(clientId, out _);
        await webSocket.CloseAsync(result.CloseStatus.Value, result.CloseStatusDescription, CancellationToken.None);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
    }
});

app.Run("http://localhost:5000");
