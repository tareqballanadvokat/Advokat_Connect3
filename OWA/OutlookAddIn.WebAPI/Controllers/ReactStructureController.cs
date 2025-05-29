using System.Linq;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("api/react-structure")]
[EnableCors("AllowAll")]
public class ReactStructureController : ControllerBase
{
    //private static List<HierarchyTree> favoritesList = new List<HierarchyTree>();
    //private static List<HierarchyTree> customTree = new List<HierarchyTree>(); 
    private readonly ILogger<ReactStructureController> _logger;
    IDatabaseServiceMock _databaseMock;

    public ReactStructureController(ILogger<ReactStructureController> logger, IDatabaseServiceMock databaseMock)
    {
        _logger = logger;
        _databaseMock = databaseMock;
    }
     


    [HttpGet("get-structure-by-id")]
    public ActionResult<HierarchyTree> GetStructureById([FromQuery] int? parentId)
    { 
        return new JsonResult(DatabaseServiceMock.customTree.Where(x => x.RootId == parentId).ToList());
    }

 

    [HttpPost("search-cases")]
    public ActionResult<HierarchyTree> SearchCases([FromBody] SearchRequest query)
    {
        //needs to remove currently added nodes!!!!
        var customTree = DatabaseServiceMock.customTree;
        var list = new List<HierarchyTree>();
        var allPossibilities = customTree.Where(x => x.Name.ToLower().Contains(query.Query.ToLower())).ToList();
        //foreach(var item in allPossibilities)
        //{
        //    var dd = customTree.Where(x => x.Id == item.Id).First();
        //    while (dd.RootId != 0)
        //    {
        //        dd = customTree.Where(x => x.Id == dd.RootId).First();
        //    } 
        //    if (!list.Any(x => x.Id== dd.Id))
        //    list.Add(dd);
        //}
        //foreach (var item in DatabaseServiceMock.favoritesList)
        //{
        //    list.Remove(item);
        //}
        return new JsonResult(allPossibilities);
    }

    [HttpGet("get-structure")]
    public ActionResult<HierarchyTree> GetStructure()
    {
        //needs to remove currently added nodes!!!!
        var customTree = DatabaseServiceMock.customTree;
        var list = new List<HierarchyTree>();
        var allPossibilities = customTree.ToList();
        foreach (var item in allPossibilities.Where(x => x.IsStructure))
        {
  
            if (!list.Any(x => x.Id == item.Id))
                list.Add(item);
        }
   
        return new JsonResult(list);
    }


    [HttpPost("get-file-content")]
    public ActionResult<string> GetFileContent([FromBody] SearchRequest query)
    {
        //needs to remove currently added nodes!!!!
        var customTree = DatabaseServiceMock.customTree;
        var list = new List<HierarchyTree>();
        var allPossibilities = customTree.Where(x => x.Id == Convert.ToInt32(query.Query)).FirstOrDefault();
        return new JsonResult(allPossibilities.Name);
    }
}


