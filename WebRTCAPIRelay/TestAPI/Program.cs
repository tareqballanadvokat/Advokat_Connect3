using Advokat.Connector.Plugin;
using Advokat.Core.AspNetCore.Pipeline;
using Advokat.Legacy.Settings;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WebRTCAPIRelay;

namespace TestAPI
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.
            builder.Services.AddControllers();
            builder.Services.AddHttpClient();

            builder.Services.TryAddSingleton<SettingsService>();
            builder.Services.TryAddSingleton<ISettingsService>(sp => sp.GetRequiredService<SettingsService>());

            await new ConnectorPlugIn().AddServicesAsync(builder.Services);

            builder.Services.AddWebRTCRemote();
            builder.Services.AddPipelineHook();
            var app = builder.Build();

            app.UsePipelineHook();
            app.UseRouting()
                .UseEndpoints(x => x.MapControllers());

            await app.Services.StartWebRTC();
            app.Run();
        }
    }
}
