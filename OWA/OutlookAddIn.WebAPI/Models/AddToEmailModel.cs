namespace OutlookAddIn.WebAPI.Models;
public class AddToEmailModel
{
    public string CaseId { get; set; }
    public string ServiceAbbreviationType { get; set; }
    public string SrviceSB { get; set; }
    public string ServiceTime { get; set; }
    public string ServiceText { get; set; }
    public string InternetMessageId { get; set; }
    public string EmailName { get; set; }
    public string EmailContent { get; set; }
    public int UserID { get; set; }
    public Attachment[] Attachments { get; set; }
}

public class Attachment
{
    public string FileName { get; set; }
    public string ContentBase64 { get; set; } 
}