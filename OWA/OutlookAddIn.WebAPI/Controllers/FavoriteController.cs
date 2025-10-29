using System.Linq;
using System.Linq.Expressions;
using System.Text;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;
using SIPSorcery.Net;

namespace OutlookAddIn.WebAPI.Controllers;

[ApiController]
[Route("api/favorite")]
[EnableCors("AllowAll")]
public class FavoriteController : ControllerBase
{
    private readonly IDatabaseServiceMock _databaseMock;
    IPeerConnection _peerConnection;

    private static RTCPeerConnection _connection;
    RTCDataChannel _dataChannel;
    private readonly ILogger<FavoriteController> _logger;

    public FavoriteController(ILogger<FavoriteController> logger,
        IPeerConnection peerConnection,
        IDatabaseServiceMock databaseMock)
    {
        _logger = logger;
        _peerConnection = peerConnection;
        _databaseMock = databaseMock;
    }


    [HttpGet("StaticFillCustomData")]
    public ActionResult FillCustomData()
    {
        _databaseMock.FillCustomData();
        //    _connection = _peerConnection.Start().Result;
        // connection.DataChannels;

        //foreach (var peer in WebSocketPeerManager.ConnectedPeers)
        //{
        //   var dc =  peer.RTCPeerConnection.createDataChannel("nazwa");
        //    dc.Result.send("sdsd");
        //}
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



        if (_dataChannel != null)
        {
            byte[] messageBytes = Encoding.UTF8.GetBytes("Asdsa");
            _dataChannel.send(messageBytes);
        }
     
        return new JsonResult(allFavorites);
    }
  
    [HttpPost("add")]
    public ActionResult<HierarchyTree> AddToFavorites([FromBody] FavoriteAction query)
    {
        DatabaseServiceMock.FillMockData();
        var customTree = DatabaseServiceMock.customTree;
        var dd = customTree.Where(x => x.Id == Convert.ToInt32(query.NodeId)).First();
        while(dd.RootId != 0 && dd.RootId!= null)
        {
            dd = customTree.Where(x => x.Id == dd.RootId).First();
        }

        DatabaseServiceMock.favoritesList.Add(dd);
        var ids = new List<int>();
        ids.Add(dd.Id);
        while (ids.Count>0)
        {
           var nodesToAdd = customTree.Where(x => x.RootId != null && ids.Contains( x.RootId.Value )).ToList();
            ids.Clear();
            ids.AddRange(nodesToAdd.Select(x => x.Id).ToList());
            DatabaseServiceMock.favoritesList.AddRange(nodesToAdd);
        }
         
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

