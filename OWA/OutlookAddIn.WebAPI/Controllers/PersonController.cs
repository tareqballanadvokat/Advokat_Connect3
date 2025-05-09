using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;

namespace OutlookAddIn.WebAPI.Controllers;
 
[ApiController]
[EnableCors("AllowAll")]
[Route("api/person")]
 
public class PersonController : ControllerBase
{ 
    public PersonController()
    {

    }

    [HttpPost("search")]
    public ActionResult SearchPerson([FromBody] PersonModel query)
    {
        return new JsonResult(DatabaseServiceMock.allPersons.Where(x => x.FullName.Contains(query.FullName)).ToList());
    }

    [HttpPost("add")]
    public ActionResult AddPerson([FromBody] PersonModel query)
    {
        if (DatabaseServiceMock.customPersons.Where(x => x.Id == query.Id).Any())
        {
            //return Ok(DatabaseServiceMock.customEmails);
            return new JsonResult(DatabaseServiceMock.customPersons);
        }
        DatabaseServiceMock.customPersons.Add(query);

        return new JsonResult(DatabaseServiceMock.customPersons);
    }


    [HttpGet("get")]
    public ActionResult<PersonModel> GetPerson()
    {
        return new JsonResult(DatabaseServiceMock.allPersons);
    }
}

 