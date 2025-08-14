using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using TestAPI.DTOs;

namespace TestAPI.Controllers
{
    [Route("[controller]")]
    [ApiController]
    public class AktenController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get() //([FromBody] AktenQuery aktenQuery)
        {
            string response = JsonSerializer.Serialize(new AktLookUpResponse()
            {
                AktId = 1234567,
                AKurz = "abcdefg",
                Causa = "hijklmn"
            });

            return this.Ok(response);
        }
    }
}
