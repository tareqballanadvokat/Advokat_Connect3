using System.Linq;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("api/abbreviation")]
[EnableCors("AllowAll")]
public class AbbreviationController : ControllerBase
{
    //private static List<HierarchyTree> favoritesList = new List<HierarchyTree>();
    //private static List<HierarchyTree> customTree = new List<HierarchyTree>(); 
    private readonly ILogger<AbbreviationController> _logger;
    IDatabaseServiceMock _databaseMock;

    public AbbreviationController(ILogger<AbbreviationController> logger, IDatabaseServiceMock databaseMock)
    {
        _logger = logger;
        _databaseMock = databaseMock;
    }
      

    [HttpGet("get-abbreviation")]
    public ActionResult<Abbreviation> GetStructure()
    {
        return new JsonResult(new List<Abbreviation> { new Abbreviation() { Id =1, Name ="ASDS"}, new Abbreviation() { Id = 2, Name = "Abb1" }, new Abbreviation() { Id = 3, Name = "Abb 2" } });
    }
}


