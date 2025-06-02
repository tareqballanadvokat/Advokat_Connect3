using System.Linq;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("api/favorite")]
[EnableCors("AllowAll")]
public class FavoriteController : ControllerBase
{
    private readonly IDatabaseServiceMock _databaseMock;
    private readonly ILogger<FavoriteController> _logger;

    public FavoriteController(ILogger<FavoriteController> logger, IDatabaseServiceMock databaseMock)
    {
        _logger = logger;
        _databaseMock = databaseMock;
    }


    [HttpGet("StaticFillCustomData")]
    public ActionResult FillCustomData()
    {
        _databaseMock.FillCustomData();
      
        return Ok();
    }


    [HttpGet("get-my-favorites")]
    public ActionResult<HierarchyTree> GetMyFavorites()
    {
        var allFavorites = DatabaseServiceMock.favoritesList.ToList();
        var allCustomFiles = DatabaseServiceMock.customFileItems.ToList();
        var mappingsCustomFiles = DatabaseServiceMock.customFileItemsToFavoriteMapping.ToList();

        foreach(var mapping in mappingsCustomFiles)
        {
           var item =  allCustomFiles.Where(x => x.Id == mapping.CustomItemId).First();
            allFavorites.Add(new HierarchyTree
            {
                HasChild = false,
                Causa = "",
                HasUrl = false,
                Id = mapping.CustomItemId,
                IsStructure = false,
                RootId = mapping.FavoritesId,
                Url = string.Empty,
                Name = item.Name
            });
        };

        return new JsonResult(allFavorites);
    }
  
    [HttpPost("add")]
    public ActionResult<HierarchyTree> AddToFavorites([FromBody] FavoriteAction query)
    {
        var customTree = DatabaseServiceMock.customTree;
        var dd = customTree.Where(x => x.Id == Convert.ToInt32(query.NodeId)).First();
        while(dd.RootId != 0)
        {
            dd = customTree.Where(x => x.Id == dd.RootId).First();
        }
        DatabaseServiceMock.favoritesList.Add(dd);
        var list = new List<HierarchyTree>();
        list.Add(dd);
        return new JsonResult(list);
    }

    [HttpPost("delete")]
    public ActionResult RemoveFromFavorites([FromBody] FavoriteAction nodeId)
    {
        var itemToRemove = DatabaseServiceMock.favoritesList.Where(x => x.Id == Convert.ToInt32(nodeId.NodeId)).First();
        DatabaseServiceMock.favoritesList.Remove(itemToRemove);
        return Ok();
    }

} 
 