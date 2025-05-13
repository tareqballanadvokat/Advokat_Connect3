using OutlookAddIn.WebAPI.Models;

namespace OutlookAddIn.WebAPI.Services
{
    public class DatabaseServiceMock : IDatabaseServiceMock
    {
        public static List<AddEmailModel> customEmails = new List<AddEmailModel>();
        public static List<ServiceModel>  customService = new List<ServiceModel>();
        public static List<PersonModel>  allPersons = new List<PersonModel>();
        public static List<PersonModel>  customPersons = new List<PersonModel>();
        public static List<HierarchyTree> favoritesList = new List<HierarchyTree>();
        public static List<HierarchyTree> customTree = new List<HierarchyTree>();
        public static List<HierarchyTree> customItems = new List<HierarchyTree>();

        public void Insert()
        {
            throw new NotImplementedException();
        }
        public void FillCustomData()
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


            allPersons.Add(new PersonModel { Address = "Address 43",Email="test@gmail.com",  City = "Wienna", FullName = "Br Advocat", Id =1, Phone = "6532345", UserID = 1, WebSite = "google.com" });
            allPersons.Add(new PersonModel { Address = "Address 2 ", Email = "asd.asds@onet.pl", City = "South Hampton", FullName = "Darek Ogórek", Id = 2, Phone = "+489086468", UserID = 1, WebSite = "google.com" });
            allPersons.Add(new PersonModel { Address = "Address 2 3/6 ", Email = "asd.test@onet.pl", City = "Insbruck", FullName = "Advocat", Id = 3, Phone = "22-55780-9776", UserID = 1, WebSite = "google.com" });
            allPersons.Add(new PersonModel { Address = "Address 3 6/3", Email = "test@wp.pl", City = "Wrocław", FullName = "Test Manager", Id =4, Phone = "4854446789", UserID = 1, WebSite = "google.com" });
            allPersons.Add(new PersonModel { Address = "Address 5345 ", Email = "email@livechat.com", City = "Wrocław", FullName = "Test Devops", Id =4, Phone = "0773453455", UserID = 1, WebSite = "google.com" });
            allPersons.Add(new PersonModel { Address = "Address 4444 ", Email = "email@email.com", City = "Nysa", FullName = "Test Manager 2", Id =4, Phone = "113335677", UserID = 1, WebSite = "google.com" });

            customPersons.Add(allPersons.Last());


        }
    }
}
