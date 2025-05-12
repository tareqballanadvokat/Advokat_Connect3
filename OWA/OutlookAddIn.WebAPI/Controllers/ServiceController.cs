using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;

namespace OutlookAddIn.WebAPI.Controllers;
 
[ApiController]
[EnableCors("AllowAll")]
[Route("api/service")]
 
public class ServiceController : ControllerBase
{ 
    public ServiceController()
    {

    }

    [HttpPost("add-service")]
    public ActionResult AddToService([FromBody] ServiceModel query)
    {
        if (DatabaseServiceMock.customService.Where(x => x.CaseId == query.CaseId).Any())
        {
            var data = DatabaseServiceMock.customService.Where(x => x.CaseId == query.CaseId).First();
            data.ServiceText = query.ServiceText;
            data.SrviceSB = query.SrviceSB;
            data.ServiceTime = query.ServiceTime;
            //return Ok(DatabaseServiceMock.customEmails);
            return new JsonResult(DatabaseServiceMock.customEmails);
        }
        DatabaseServiceMock.customService.Add(query);

        return new JsonResult(DatabaseServiceMock.customService);
    }


    [HttpGet("get-services")]
    public ActionResult<ServiceModel> GetService()
    {
        return new JsonResult(DatabaseServiceMock.customService);
    }

    //THOIS REPLACES GET-SERVICEs
    [HttpGet("get-registered")]
    public ActionResult<RegisteredServiceModel> GetRegistered()
    {
        var dataToReturn = DatabaseServiceMock.customService.Select(

            x => new RegisteredServiceModel
            {
                CaseId = x.CaseId,
                ServiceAbbreviationType = x.ServiceAbbreviationType,
                 ServiceText = x.ServiceText,
                 ServiceTime = x.ServiceTime,
                 SrviceSB = x.SrviceSB,
                 UserID = x.UserID
                //InsertDate = x.InsertDate.ToShortDateString(),
                //EmailName = x.EmailName

            }).ToList();
        return new JsonResult(dataToReturn);
    }

}

