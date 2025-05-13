using System.Globalization;

namespace OutlookAddIn.WebAPI.Models;
public class AddEmailModel
{
    public string CaseId { get; set; }
    public string ServiceAbbreviationType { get; set; }
    public string SrviceSB { get; set; }
    public string ServiceTime { get; set; }
    public string ServiceText { get; set; }
    public string InternetMessageId { get; set; }
    public string EmailName { get; set; }
    public string EmailContent { get; set; }
    public string EmailFolder { get; set; }
    public int UserID { get; set; }
    public Attachment[] Attachments { get; set; }
    public DateTime InsertDate { get; set; }
    public DateTime UpdateDate { get; set; } 
}
//timestamp
//inserDate
//updateDate

public class Attachment
{
    public string Id { get; set; }
    public string OriginalFileName { get; set; }
    public string FileName { get; set; }
    public string ContentBase64 { get; set; } 
    public string Folder { get; set; }
}

public class RegisteredEmailModel
{
    public string CaseId { get; set; } 
    public string EmailName { get; set; } 
    public string InsertDate { get; set; }
    public int UserID { get; set; }
}