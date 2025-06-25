namespace OutlookAddIn.WebAPI.Models;


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
