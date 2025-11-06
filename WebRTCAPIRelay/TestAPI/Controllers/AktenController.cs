using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Text.Json;
using TestAPI.DTOs;

namespace TestAPI.Controllers
{
    [Route("/connect/token")]

    //[Route("[controller]")]
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

            Random rng = new Random();


            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var stringChars = new char[8];

            for (int i = 0; i < stringChars.Length; i++)
            {
                stringChars[i] = chars[rng.Next(chars.Length)];
            }

            //FileStream fs = new FileStream(new(stringChars), FileMode.Create, FileAccess.ReadWrite, FileShare.None);
            FileStream fs = new FileStream("test", FileMode.Create, FileAccess.ReadWrite, FileShare.None);

            fs.SetLength(sizeInMB * 1024 * 1024);
            //return this.File(fs, "text/json");

            byte[]? data = new byte[sizeInMB * 1024 * 1024];

            rng.NextBytes(data);
            fs.Write(data);
            fs.Seek(0, SeekOrigin.Begin);

            //data = null;
            //GC.Collect();

            return this.File(fs, "text/json");
        }
    }
}
