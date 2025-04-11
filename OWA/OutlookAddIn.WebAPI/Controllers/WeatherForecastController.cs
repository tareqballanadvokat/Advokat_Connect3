using System.Linq;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("[controller]/[action]")]
[EnableCors("AllowAll")]
public class WeatherForecastController : ControllerBase
{

    private static List<HierarchyTree> favoritesList = new List<HierarchyTree>();
    private static List<HierarchyTree> customTree = new List<HierarchyTree>();
    private static List<HierarchyTree> customItems = new List<HierarchyTree>();


    private readonly ILogger<WeatherForecastController> _logger;

    public WeatherForecastController(ILogger<WeatherForecastController> logger)
    {
        _logger = logger;

    }

    [HttpGet(Name = "FillCustomData")]
    public ActionResult FillCustomData()
    {
        customTree.Add(new HierarchyTree { Id = 1, Name = "ADVOKAT", RootId = 0, IsStructure = true, HasChild = true, Causa = "Root" });
        customTree.Add(new HierarchyTree { Id = 2, Name = "Test", RootId = 1, HasChild = true, IsStructure = true, Causa = "Roots" });
        customTree.Add(new HierarchyTree { Id = 3, Name = "Outlook", RootId = 1, HasChild = false, IsStructure = true, Causa = "Rosot" });
        customTree.Add(new HierarchyTree { Id = 4, Name = "Zusammenarbeit", RootId = 1, IsStructure = true, Causa = "Rvoot" });

        customTree.Add(new HierarchyTree { Id = 5, Name = "Briefe", RootId = 4, HasChild = true, IsStructure = true, Causa = "Raoot" });
        customTree.Add(new HierarchyTree { Id = 8, Name = "Briefe2", RootId = 4, HasChild = true, IsStructure = true, Causa = "Roodt" });

        customTree.Add(new HierarchyTree { Id = 6, Name = "Briefe", RootId = 3, HasChild = true, IsStructure = true, Causa = "Roota" });
        customTree.Add(new HierarchyTree { Id = 7, Name = "Schriftsätze", RootId = 3, HasChild = true, IsStructure = true, Causa = "dRoot" });

        customTree.Add(new HierarchyTree { Id = 100, Name = "Test1.pdf", RootId = 4, IsStructure = false });
        customTree.Add(new HierarchyTree { Id = 102, Name = "ssssss.pdf", RootId = 4, IsStructure = false });
        customTree.Add(new HierarchyTree { Id = 103, Name = "Test3.pdf", RootId = 4, IsStructure = false });
        customTree.Add(new HierarchyTree { Id = 104, Name = "Test4.pdf", RootId = 5, IsStructure = false });
        customTree.Add(new HierarchyTree { Id = 105, Name = "Test5.pdf", RootId = 5, IsStructure = false });


        customTree.Add(new HierarchyTree { Id = 10, Name = "ADVOKAT/10", RootId = 0, IsStructure = true, HasChild = true, Causa = "Root2" });
        customTree.Add(new HierarchyTree { Id = 11, Name = "Test", RootId = 10, HasChild = true, IsStructure = true, Causa = "Rowot" });
        customTree.Add(new HierarchyTree { Id = 13, Name = "Outlook", RootId = 10, HasChild = false, IsStructure = true, Causa = "eeRoot" });
        customTree.Add(new HierarchyTree { Id = 14, Name = "Zusammenarbeit", RootId = 10, IsStructure = true, Causa = "Rofot" });

        customTree.Add(new HierarchyTree { Id = 15, Name = "Briefe", RootId = 11, HasChild = true, IsStructure = true, Causa = "Roosadt" });
        customTree.Add(new HierarchyTree { Id = 18, Name = "Briefe2", RootId = 15, HasChild = true, IsStructure = true, Causa = "Roosdst" });

        customTree.Add(new HierarchyTree { Id = 16, Name = "Briefe", RootId = 13, HasChild = true, IsStructure = true, Causa = "Rooaat" });
        customTree.Add(new HierarchyTree { Id = 17, Name = "Schriftsätze", RootId = 14, HasChild = true, IsStructure = true });

        customTree.Add(new HierarchyTree { Id = 110, Name = "Test1.pdf", RootId = 14, IsStructure = false, HasUrl = true, Url = "https://cdn.britannica.com/55/2155-050-604F5A4A/lion.jpg" });
        customTree.Add(new HierarchyTree { Id = 112, Name = "asd.pdf", RootId = 15, IsStructure = false, HasUrl = true, Url = "https://cdn.britannica.com/55/2155-050-604F5A4A/lion.jpg" });
        customTree.Add(new HierarchyTree { Id = 113, Name = "Test3.pdf", RootId = 14, IsStructure = false });
        customTree.Add(new HierarchyTree { Id = 114, Name = "Test4.pdf", RootId = 16, IsStructure = false, HasUrl = true, Url = "https://cdn.britannica.com/55/2155-050-604F5A4A/lion.jpg" });
        customTree.Add(new HierarchyTree { Id = 115, Name = "Test5.pdf", RootId = 16, IsStructure = false });

        favoritesList.Add(customTree.Where(x => x.RootId == 10).First());
        return Ok();
    }


    [HttpGet(Name = "GetMyFavorites")]
    public ActionResult<HierarchyTree> GetMyFavorites()
    {
        return new JsonResult(favoritesList);
    }

    [HttpGet(Name = "GetStructureById")]
    public ActionResult<HierarchyTree> GetStructureById([FromQuery] int? parentId)
    { 
        return new JsonResult(customTree.Where(x => x.RootId == parentId).ToList());
    }

 

    [HttpGet(Name = "GetCasesByParentId")]
    public ActionResult<HierarchyTree> GetCasesByParentId([FromQuery] int? parentId)
    {
        return new JsonResult(customItems.Where(x => x.RootId == parentId).ToList());
    }


    [HttpPost(Name = "SearchCases")]
    public ActionResult<HierarchyTree> SearchCases([FromBody] SearchRequest query)
    {
        //needs to remove currently added nodes!!!!
        var list = new List<HierarchyTree>();
        var allPossibilities = customTree.Where(x => x.Name.ToLower().Contains(query.Query.ToLower())).ToList();
        foreach(var item in allPossibilities)
        {
            var dd = customTree.Where(x => x.Id == item.Id).First();
            while (dd.RootId != 0)
            {
                dd = customTree.Where(x => x.Id == dd.RootId).First();
            } 
            if (!list.Any(x => x.Id== dd.Id))
            list.Add(dd);
        }
        foreach (var item in favoritesList)
        {
            list.Remove(item);
        }
            return new JsonResult(list);
    }


    [HttpPost(Name = "AddToFavorites")]
    public ActionResult<HierarchyTree> AddToFavorites([FromBody] FavoriteAction query)
    {
        var dd = customTree.Where(x => x.Id == Convert.ToInt32(query.NodeId)).First();
        while(dd.RootId != 0)
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
        var itemToRemove = favoritesList.Where(x => x.Id == Convert.ToInt32(nodeId.NodeId)).First();
        favoritesList.Remove(itemToRemove);
        return Ok();
    }

}
public class SearchRequest
{
    public string Query { get; set; }
}
public class FavoriteAction
{
    public int NodeId { get; set; }
}

public class HierarchyTree
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int? RootId { get; set; }
    public bool HasChild { get; set; }
    public bool IsStructure { get; set; }
    public string Causa { get; set; }
    
    public bool HasUrl { get; set; }
    public string Url { get; set; }
}

 