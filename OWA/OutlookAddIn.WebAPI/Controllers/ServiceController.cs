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
}

 