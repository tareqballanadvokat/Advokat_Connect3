namespace OutlookAddIn.WebAPI.Models;
public class ServiceModel
{
    public int Id { get; set; } = default;
    public string CaseId { get; set; }
    public string ServiceAbbreviationType { get; set; }
    public string ServiceSB { get; set; }
    public string ServiceTime { get; set; }
    public string ServiceText { get; set; }
    public DateTime InsertDate { get; set; }
    public int UserID { get; set; }
}

public class RegisteredServiceModel
{
    public string CaseId { get; set; }
    public string ServiceAbbreviationType { get; set; }
    public string SrviceSB { get; set; }
    public string InsertDate { get; set; }
    public string ServiceTime { get; set; }
    public string ServiceText { get; set; } 
    public int UserID { get; set; }
}
