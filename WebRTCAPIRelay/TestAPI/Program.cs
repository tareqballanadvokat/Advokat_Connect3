
using Advokat.Connector.Library;
using Advokat.Connector.Plugin;
using Advokat.Core.AspNetCore.Pipeline;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Text;
using WebRTCAPIRelay;
using WebRTCClient;

namespace TestAPI
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.
            builder.Services.AddControllers();
            builder.Services.TryAddSingleton<IRequestHandler, RequestHandler>();

            builder.Services.AddWebRTCRemote();
            builder.Services.AddHttpClient();
            builder.Services.AddPipelineHook();

            await new ConnectorPlugIn().AddServicesAsync(builder.Services);

            var app = builder.Build();

            app.UsePipelineHook();
            app.UseRouting()
                .UseEndpoints(x => x.MapControllers());

            HttpClient httpClient = app.Services.GetRequiredService<HttpClient>();
            WebRTCPeer? remote = app.Services.GetService<WebRTCPeer>();
            if (remote == null)
            {
                throw new Exception("Cannot start WebRTCpeer. No WebRTCpeer added to services. Add WebRTCpeer to API services.");
            }

            remote.OnMessageReceived += async (IWebRTCPeer sender, byte[] data) => {
                using var serviceScope = app.Services.CreateScope();
                RequestPayload request =  ParseHttpRequest(data, serviceScope.ServiceProvider);
                IRequestHandler requestHandler = app.Services.GetRequiredService<IRequestHandler>();
                ResponsePayload response = await requestHandler.InvokeAsync(request);
                await sender.SendMessageToPeer(response.StatusCode.ToString());
            };

            await remote.Connect();
            app.Run();
        }

        private static RequestPayload ParseHttpRequest(byte[] data, IServiceProvider serviceProvider)
        {
            string requestString = Encoding.UTF8.GetString(data);
            string[] lines = requestString.Split("\n"); // /r still remains

            string requestLine = lines[0];
            string[] otions = requestLine.Split();

            string method = otions[0];
            string uriString = otions[1];
            string httpVersion = otions[2];

            //Uri uri = new Uri(uriString);
            Dictionary<string, string> headers = new();

            foreach(string line in lines.Skip(1))
            {
                if(line == string.Empty || line == "\r" || line == "\r\n" )
                {
                    break;
                }

                string[] header = line.Split(": ");
                headers.Add(header[0], header[1]);
            }


            RequestPayload request = new RequestPayload()
            {
                Method = method,
                Uri = uriString,
                Headers = headers,
            };

            return request;
        }
    }
}
