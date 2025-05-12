using System.Collections.Generic;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;
using static System.Runtime.InteropServices.JavaScript.JSType;

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
    public ActionResult AddToFavorites([FromBody] AddEmailModel query)
    {
        if (DatabaseServiceMock.customEmails.Where(x => x.InternetMessageId == query.InternetMessageId).Any())
        {
            //return Ok(DatabaseServiceMock.customEmails);
            var data = DatabaseServiceMock.customEmails.Where(x => x.InternetMessageId == query.InternetMessageId).First();
            data.ServiceText = query.ServiceText;
            data.SrviceSB = query.SrviceSB;
            data.ServiceTime = query.ServiceTime;
            data.EmailName = query.EmailName;
            data.UpdateDate = DateTime.Now; 
            return new JsonResult(DatabaseServiceMock.customEmails);
        }
        query.InsertDate = DateTime.Now;
        query.UpdateDate = DateTime.Now;
        DatabaseServiceMock.customEmails.Add(query);

        return new JsonResult(DatabaseServiceMock.customEmails);
    }


    [HttpGet("get-registered")]
    public ActionResult<RegisteredEmailModel> GetRegistered()
    {
        var dataToReturn = DatabaseServiceMock.customEmails.Select(

            x => new RegisteredEmailModel
            {
                CaseId = x.CaseId,
                InsertDate = x.InsertDate.ToShortDateString(), 
                EmailName = x.EmailName

            }).ToList();
        return new JsonResult(dataToReturn);
    }

    [HttpPost("get")]
    public ActionResult<AddEmailModel> GetItem([FromBody] EmailModel id)
    {
        var data =DatabaseServiceMock.customEmails.Where(x => x.InternetMessageId == id.Id).FirstOrDefault();
        return new JsonResult(data);
    }
}
public class EmailModel
{
    public string Id { get; set; }
}

 