using System.Collections.Generic;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using OutlookAddIn.WebAPI.Models;
using OutlookAddIn.WebAPI.Services;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace OutlookAddIn.WebAPI.Controllers;
 
[ApiController]
[EnableCors("AllowAll")]
[Route("api/email")]
 
public class EmailController : ControllerBase
{ 

    public EmailController()
    {

    }

    [HttpPost("add-to-advocat")]
    public ActionResult AddToFavorites([FromBody] AddEmailModel query)
    {
        if (DatabaseServiceMock.customEmails.Where(x => x.InternetMessageId == query.InternetMessageId).Any())
        {
            //return Ok(DatabaseServiceMock.customEmails);
            var data = DatabaseServiceMock.customEmails.Where(x => x.InternetMessageId == query.InternetMessageId).First();
            data.ServiceText = query.ServiceText;
            data.ServiceSB = query.ServiceSB;
            data.ServiceTime = query.ServiceTime;
            data.EmailName = query.EmailName;
            data.UpdateDate = DateTime.Now;
            //var attList = query.Attachments.ToList();
            //foreach (var attchment in data.Attachments)
            //{
            //    var att = attList.Where(x => x.Id == attchment.Id).First();
            //    if (att != null) 
            //    {
            //        attchment.OriginalFileName = att.OriginalFileName;
            //        attchment.FileName = att.FileName;
            //        attchment.Folder = att.Folder;
            //    }
            //    attList.Remove(att);
            //}
            data.Attachments = query.Attachments;
            BindEmailAndAttachmentWithHierarchy(data);

            return new JsonResult(DatabaseServiceMock.customEmails);
        }
        query.InsertDate = DateTime.Now;
        query.UpdateDate = DateTime.Now;
        DatabaseServiceMock.customEmails.Add(query);

        BindEmailAndAttachmentWithHierarchy(query);
        return new JsonResult(DatabaseServiceMock.customEmails);
    }

    private void BindEmailAndAttachmentWithHierarchy(AddEmailModel data)
    {
        var folderDestination = DatabaseServiceMock.favoritesList.Where(x => Convert.ToInt32(data.EmailFolder) == x.Id).FirstOrDefault();
        if (folderDestination != null)
        {
            CustomItem customEmail = new CustomItem
            {
                Content = data.EmailContent,
                InternetHeaderId = data.InternetMessageId,
                Name = data.EmailName+".eml",
                Type = "E",
                UserId = data.UserID,
                Id = DatabaseServiceMock.CustomItemCounter
            };
            folderDestination.HasChild = true;
            DatabaseServiceMock.CustomItemCounter++;
            DatabaseServiceMock.customFileItems.Add(customEmail);
            DatabaseServiceMock.customFileItemsToFavoriteMapping.Add(new FavoritesXCustomItem { CustomItemId = customEmail.Id, FavoritesId = folderDestination.Id });
        }

        foreach (var att in data.Attachments)
        {
            var attFolderDestination = DatabaseServiceMock.favoritesList.Where(x => Convert.ToInt32(att.Folder) == x.Id).FirstOrDefault();
            if (attFolderDestination != null)
            {
                attFolderDestination.HasChild = true;
                CustomItem customEmail = new CustomItem
                {
                    Content = att.ContentBase64,
                    InternetHeaderId = att.Id,
                    Name = att.FileName,
                    Type = "A",
                    UserId = data.UserID,
                    Id = DatabaseServiceMock.CustomItemCounter
                };

                DatabaseServiceMock.CustomItemCounter++;
                DatabaseServiceMock.customFileItems.Add(customEmail);
                DatabaseServiceMock.customFileItemsToFavoriteMapping.Add(new FavoritesXCustomItem { CustomItemId = customEmail.Id, FavoritesId = attFolderDestination.Id });

            }
        } 
    }

    [HttpGet("get-registered")]
    public ActionResult<RegisteredEmailModel> GetRegistered()
    {
        var dataToReturn = DatabaseServiceMock.customEmails.Select(

            x => new RegisteredEmailModel
            {
                Id = int.Parse($"{x.UserID}{x.InsertDate:HHmmss}"),
                CaseId = x.CaseName,//TODO: caseId :int
                InsertDate = x.InsertDate.ToShortDateString(), 
                EmailName = x.EmailName

            }).ToList();
        return new JsonResult(dataToReturn);
    }

    [HttpPost("get")]
    public ActionResult<AddEmailModel> GetItem([FromBody] EmailModel id)
    {
        var data =DatabaseServiceMock.customEmails.Where(x => x.InternetMessageId == id.Id).FirstOrDefault();
        if (data!= null)
        data.EmailFolder = DatabaseServiceMock.customTree.First(x => x.Id == data.EmailFolderId)?.Name;
        return new JsonResult(data);
    }
}
public class EmailModel
{
    public string Id { get; set; }
}

 