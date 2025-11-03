using Advokat.Connector.Plugin;
using Advokat.Core.AspNetCore.Pipeline;
using Advokat.Legacy.Settings;
using Advokat.WebRTC.Plugin;
using Microsoft.Extensions.DependencyInjection.Extensions;

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
            builder.Services.AddPipelineHook();

            WebRTCPlugin plugin = new WebRTCPlugin();
            plugin.Configuration = builder.Configuration;

            await plugin.AddServicesAsync(builder.Services);
            var app = builder.Build();

            app.UsePipelineHook();
            app.UseRouting()
                .UseEndpoints(x => x.MapControllers());

            await plugin.UseServicesAsync(app.Services);
            app.Run();
        }
    }
}
