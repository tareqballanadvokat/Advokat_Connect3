using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Text.Json;
using TestAPI.DTOs;

namespace TestAPI.Controllers
{
    [Route("[controller]")]
    [ApiController]
    public class AktenController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get([FromBody] AktenQuery aktenQuery)
        {
            AktLookUpResponse aktLookUpResponse = new AktLookUpResponse()
            {
                AktId = 1234567,
                AKurz = "abcdefg",
                Causa = "hijklmn"
            };

            return this.Ok(aktLookUpResponse);
        }

        [HttpPost]
        public IActionResult Post()
        {
            int sizeInMB = 3;

            FileStream fs = new FileStream("test", FileMode.Create, FileAccess.ReadWrite, FileShare.None);
            fs.SetLength(sizeInMB * 1024 * 1024);
            //return this.File(fs, "text/json");

            byte[]? data = new byte[sizeInMB * 1024 * 1024];
            Random rng = new Random();

            rng.NextBytes(data);
            fs.Write(data);
            fs.Seek(0, SeekOrigin.Begin);

            //data = null;
            //GC.Collect();

            return this.File(fs, "text/json");
        }
    }
}
