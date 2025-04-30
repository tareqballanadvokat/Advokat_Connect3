using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("[controller]/[action]")]
[EnableCors("AllowAll")]
public class WeatherForecastController : ControllerBase
{

    private static List<HierarchyTree> favoritesList = new List<HierarchyTree>();
    private static List<HierarchyTree> customTree = new List<HierarchyTree>();
    IDatabaseServiceMock _databaseMock;

    private readonly ILogger<WeatherForecastController> _logger;

    public WeatherForecastController(ILogger<WeatherForecastController> logger, IDatabaseServiceMock databaseMock)
    {
        _logger = logger;
        _databaseMock = databaseMock;
    }

    //[HttpGet(Name = "FillCustomData")]
    //public ActionResult FillCustomData()
    //{
        
    //    return Ok();
    //}


    [HttpGet(Name = "GetMyFavorites")]
    public ActionResult<HierarchyTree> GetMyFavorites()
    {
        return new JsonResult(DatabaseServiceMock.favoritesList);
    }

    [HttpGet(Name = "GetStructureById")]
    public ActionResult<HierarchyTree> GetStructureById([FromQuery] int? parentId)
    {
        return new JsonResult(DatabaseServiceMock.customTree.Where(x => x.RootId == parentId).ToList());
    }



    //[HttpGet(Name = "GetCasesByParentId")]
    //public ActionResult<HierarchyTree> GetCasesByParentId([FromQuery] int? parentId)
    //{
    //    return new JsonResult(customItems.Where(x => x.RootId == parentId).ToList());
    //}


    //[HttpPost(Name = "SearchCases")]
    //public ActionResult<HierarchyTree> SearchCases([FromBody] SearchRequest query)
    //{
    //    //needs to remove currently added nodes!!!!
    //    var list = new List<HierarchyTree>();
    //    var allPossibilities = customTree.Where(x => x.Name.ToLower().Contains(query.Query.ToLower())).ToList();
    //    foreach (var item in allPossibilities)
    //    {
    //        var dd = customTree.Where(x => x.Id == item.Id).First();
    //        while (dd.RootId != 0)
    //        {
    //            dd = customTree.Where(x => x.Id == dd.RootId).First();
    //        }
    //        if (!list.Any(x => x.Id == dd.Id))
    //            list.Add(dd);
    //    }
    //    foreach (var item in favoritesList)
    //    {
    //        list.Remove(item);
    //    }
    //    return new JsonResult(list);
    //}


    [HttpPost(Name = "AddToFavorites")]
    public ActionResult<HierarchyTree> AddToFavorites([FromBody] FavoriteAction query)
    {
        var customTree = DatabaseServiceMock.customTree;
        var dd = customTree.Where(x => x.Id == Convert.ToInt32(query.NodeId)).First();
        while (dd.RootId != 0)
        {
            dd = customTree.Where(x => x.Id == dd.RootId).First();
        }
        favoritesList.Add(dd);
        var list = new List<HierarchyTree>();
        list.Add(dd);
        return new JsonResult(list);
    }
    [HttpPost(Name = "RemoveFromFavorites")]
    public ActionResult RemoveFromFavorites([FromBody] FavoriteAction nodeId)
    {
        var itemToRemove = DatabaseServiceMock.favoritesList.Where(x => x.Id == Convert.ToInt32(nodeId.NodeId)).First();
        favoritesList.Remove(itemToRemove);
        return Ok();
    }

}
public class SearchRequest
{
    public string Query { get; set; }
}
 

//public class HierarchyTree
//{
//    public int Id { get; set; }
//    public string Name { get; set; }
//    public int? RootId { get; set; }
//    public bool HasChild { get; set; }
//    public bool IsStructure { get; set; }
//    public string Causa { get; set; }

//    public bool HasUrl { get; set; }
//    public string Url { get; set; }
//}

