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
    public ActionResult<PersonModel> SearchPerson([FromBody] PersonSearchRequest query)
    {
        var data = DatabaseServiceMock.allPersons.Where(x => x.FullName.ToLower().Contains(query.Query.ToLower())).ToList();
        return new JsonResult(data);
    }

    [HttpPost("add")]
    public ActionResult AddPerson([FromBody] PersonAdd query)
    {
        if (DatabaseServiceMock.customPersons.Where(x => x.Id == query.Id).Any())
        {
            //return Ok(DatabaseServiceMock.customEmails);
            return new JsonResult(DatabaseServiceMock.customPersons);
        }
        DatabaseServiceMock.customPersons.Add(DatabaseServiceMock.allPersons.Where(x => x.Id == query.Id).First());

        return new JsonResult(DatabaseServiceMock.customPersons);
    }


    [HttpGet("get")]
    public ActionResult<PersonModel> GetPerson()
    {
        return new JsonResult(DatabaseServiceMock.customPersons);
    }


    [HttpPost("delete")]
    public ActionResult RemoveFromFavorites([FromBody] FavoriteAction nodeId)
    {
        var itemToRemove = DatabaseServiceMock.customPersons.Where(x => x.Id ==  nodeId.NodeId).First();
        DatabaseServiceMock.customPersons.Remove(itemToRemove);
        return Ok();
    }
}

public class PersonSearchRequest
{
    public string Query { get; set; }
}