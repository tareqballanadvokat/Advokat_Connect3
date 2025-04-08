using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("[controller]/[action]")]
[EnableCors("AllowAll")]
public class WeatherForecastController : ControllerBase
{
    private List<HierarchyTree> customTree = new List<HierarchyTree>();
    private List<HierarchyItem> customItems = new List<HierarchyItem>();


    private readonly ILogger<WeatherForecastController> _logger;

    public WeatherForecastController(ILogger<WeatherForecastController> logger)
    {
        _logger = logger;
        customTree.Add(new HierarchyTree { Id = 1, Name = "ADVOKAT", RootId = 0 });
        customTree.Add(new HierarchyTree { Id = 2, Name = "Test", RootId = 1, LastNode = true });
        customTree.Add(new HierarchyTree { Id = 3, Name = "Outlook", RootId = 1, LastNode = false });
        customTree.Add(new HierarchyTree { Id = 4, Name = "Zusammenarbeit", RootId = 1 });

        customTree.Add(new HierarchyTree { Id = 5, Name = "Briefe", RootId = 4 , LastNode = true});
        customTree.Add(new HierarchyTree { Id = 25, Name = "Briefe2", RootId = 4, LastNode = true });

        customTree.Add(new HierarchyTree { Id = 6, Name = "Briefe", RootId = 3, LastNode = true });
        customTree.Add(new HierarchyTree { Id = 7, Name = "Schriftsätze", RootId = 3, LastNode = true });

        customItems.Add(new HierarchyItem { Id = 1, Name = "Test1.pdf", RootId = 4 });
        customItems.Add(new HierarchyItem { Id = 2, Name = "Test2.pdf", RootId = 4 });
        customItems.Add(new HierarchyItem { Id = 3, Name = "Test3.pdf", RootId = 4 });
        customItems.Add(new HierarchyItem { Id = 4, Name = "Test4.pdf", RootId = 5 });
        customItems.Add(new HierarchyItem { Id = 5, Name = "Test5.pdf", RootId = 5 });
    }

    [HttpGet(Name = "GetStructure")]
    public ActionResult<HierarchyTree> GetStructure()
    {
        return new JsonResult(customTree);
    }

    [HttpGet(Name = "GetStructureById")]
    public ActionResult<HierarchyTree> GetStructureById([FromQuery] int? parentId)
    {
      //  return new JsonResult(customTree);
        return new JsonResult(customTree.Where(x => x.RootId == parentId).ToList());
    }

    [HttpGet(Name = "GetItemsByParentId")]
    public ActionResult<HierarchyItem> GetItemsByParentId([FromQuery] int? parentId)
    {
        return new JsonResult(customItems.Where(x => x.RootId == parentId).ToList());
      //  return new JsonResult(customItems);
    }


    [HttpPost(Name = "SearchCases")]
    public ActionResult<HierarchyItem> SearchCases([FromBody] SearchRequest query)
    {
        //   return new JsonResult(customItems.Where(x => x.Name.Contains(query.Query)).ToList());
       return new JsonResult(customItems);
    }

}
public class SearchRequest
{
    public string Query { get; set; }
}
public class HierarchyTree
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int? RootId { get; set; }
    public bool LastNode { get; set; }
}

public class HierarchyItem
{
    public int Id { get; set; }
    public int? RootId { get; set; }
    public string Name { get; set; }
    public string Url { get; set; }

}