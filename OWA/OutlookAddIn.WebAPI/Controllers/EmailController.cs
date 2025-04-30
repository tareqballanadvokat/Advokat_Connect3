using System.Collections.Generic;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;

namespace OutlookAddIn.WebAPI.Controllers;
 
[ApiController]
[EnableCors("AllowAll")]
[Route("api/email")]
 
public class EmailController : ControllerBase
{ 

    public EmailController()
    {

    }

    [HttpPost("add-to-advocat")]
    public ActionResult AddToFavorites([FromBody] AddToEmailModel query)
    {
        if (DatabaseServiceMock.customEmails.Where(x => x.CaseId == query.CaseId).Any())
        {
            //return Ok(DatabaseServiceMock.customEmails);
            return new JsonResult(DatabaseServiceMock.customEmails);
        }
     

            DatabaseServiceMock.customEmails.Add(query);

        return new JsonResult(DatabaseServiceMock.customEmails);
    }


    [HttpGet("get-registered")]
    public ActionResult<AddToEmailModel> GetRegistered()
    {
        return new JsonResult(DatabaseServiceMock.customEmails);
    }
}

 