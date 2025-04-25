using System.Linq;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableCors("AllowAll")]
public class FavoriteController : ControllerBase
{
    private static List<HierarchyTree> favoritesList = new List<HierarchyTree>();
    private static List<HierarchyTree> customTree = new List<HierarchyTree>();
    private static List<HierarchyTree> customItems = new List<HierarchyTree>();
    private readonly ILogger<FavoriteController> _logger;

    public FavoriteController(ILogger<FavoriteController> logger)
    {
        _logger = logger;

    }
  
    [HttpGet(Name = "get-my-favorites")]
    public ActionResult<HierarchyTree> GetMyFavorites()
    {
        return new JsonResult(favoritesList);
    }
  
    [HttpPost("add")]
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

    [HttpPost("delete")]
    public ActionResult RemoveFromFavorites([FromBody] FavoriteAction nodeId)
    {
        var itemToRemove = favoritesList.Where(x => x.Id == Convert.ToInt32(nodeId.NodeId)).First();
        favoritesList.Remove(itemToRemove);
        return Ok();
    }

} 
 