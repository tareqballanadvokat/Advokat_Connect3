using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;

namespace OutlookAddIn.WebAPI.Controllers;
 
[ApiController]
[EnableCors("AllowAll")]
[Route("api/email")]
 
public class EmailController : ControllerBase
{
    public static List<AddToEmailModel> currentList = new List<AddToEmailModel>();

    [HttpPost("add-to-advocat")]
    public ActionResult AddToFavorites([FromBody] AddToEmailModel query)
    {
        if (currentList.Where(x=> x.CaseId == query.CaseId).Any())
        {
            return BadRequest();
        }

        currentList.Add(query);
        return Ok();
    }
}

 