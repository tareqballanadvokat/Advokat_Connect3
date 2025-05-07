/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */ 
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { getAbbreviationApi, searchCases, addService, getRegisteredService } from "../helpers/webApiReqests";
 
 
export function initService() 
{
    document.getElementById("service-search-button").onclick = ServiceSearchStructure;
    document.getElementById("service-transfer-btn").onclick = AddService;
 
    //CalculateEmailInfoAndAttachment();
    GetEmailsInLast7Days();
    GetAbbreviationAsync();
    showSuccess("Service Opened", "Your Message"); 
} 


async function GetAbbreviationAsync() {

  const options = [
      { value: "", text: "-- wybierz --" }
    ];
    await getAbbreviationApi()
      .then(data => {
          data.forEach(item => {
                  options.push({value: item.id, text: item.name});
              });

              const select = $("#service-abbreviation-select");
        
              options.forEach(opt => {
                  select.append($("<option>", { value: opt.value, text: opt.text }));
              });                
          })     
      .catch(err => {
          showError(err, "Search case failed"); 
      });
}


export async function ServiceSearchStructure()
{
  const initialData =  document.getElementById('service-search-structure-input').value;
 
  searchCases(initialData)
    .then(data => {
        const $results = $("#service-search-results-container");
        $results.empty();  

        data.forEach(item => {
        const $row = $("<div>", { class: "result-row" });

        $row.append($("<div style='width:350px'>", {class:"name"}).text(item.name));
        $row.append($("<div>", {class:"causa"}).text(item.causa));

        const $div = $("<div>", {"data-node-id": item.id, "data-node-text":item.name, class: "button"})
        .html(`<button><img width="16" id="service-search-button" height="16" src="/assets/icon-16.png" alt="Insert" title="Insert"/></button>`)
        .on("click", async function () 
            {
            const nodeId = $(this).data("node-text");
            // const nodeId = $(this).data("node-id");
            console.log(nodeId);
            $("#service-case-id-input").val(nodeId);
            
            //  var dataToLoad = await addCaseToFavorites(nodeId);
            //  initCaseStructure(dataToLoad, true);
            }
        );

        $row.append($div);
        $results.append($row);
        });
    })
    .catch(err => {
        showError(err, "Search case failed"); 
    });
}
 

export async function AddService()
{
    const item = Office.context.mailbox.item;
    var attachements = []; 
    var emailContent ;
    var itemId;
    
    try {
      const model = {
        caseId: $("#service-case-id-input").val(),
        serviceAbbreviationType:  $('#service-abbreviation-select').find(":selected").text(), ///to nie zwraca popwanej wartosci z select'a
        srviceSB:  $("#service-sb-input").val(),
        serviceTime:  $("#service-time-input").val(),
        serviceText:  $("#service-text-input").val(),
        internetMessageId :"itemId",// internetMessageId[1].trim(),
        userId :1
      };     
      await addService(model);
   await GetEmailsInLast7Days(); // jeśli zwraca Promise – jeśli nie, usuń await
  
    } catch (error) 
    {
      console.error("Błąd:", error);
    }
  
    console.log("email"); // to teraz wykona się PO zakończeniu
}




export async function GetEmailsInLast7Days() 
{
   
 await getRegisteredService()
    .then(data => {
        const $results = $("#service-tab-last-7-days-registered");
        $results.empty();  
        if (data != undefined)
        {
          data.forEach(item => {
          const $row = $("<div>", { class: "result-row" });

          $row.append($("<div>", {class:"name"}).text(item.serviceSb));
          $row.append($("<div>", {class:"name"}).text(item.caseId));
          $row.append($("<div>", {class:"causa"}).text(item.serviceTime));
          $row.append($("<div>", {class:"causa"}).text(item.serviceText));

          const $div = $("<div>", {"data-node-id": item.caseId, class: "button"});

          $row.append($div);
          $results.append($row);
          });
        }
    })
    .catch(err => {
        showError(err, "Search case failed"); 
    });
}
  


function isComposeMode(item) {
  return item.itemType === Office.MailboxEnums.ItemType.Message &&
   item.body.getTypeAsync !== undefined;
}


// function initCaseStructure(initialData, isRootLoaded) 
// {
//   var $rootElement = $("#caseStructure");

//   function buildTree(nodes, container, isRoot) 
//   {
//       nodes.forEach(node => 
//         {
//           var $div = $("<div>", { class: "folder-row", id: "folder-" + node.id });

//           var $img = $("<img>", {
//             src: "assets/folder-16.png",
//             class: "folder-icon"
//            });
//           // Tytuł + toggle
//           var $toggle = $("<span>", {
//               class: "toggle",
//               text: "+ ",
//               "data-node-id": node.id,
//               "data-last-node": node.lastNode,
//               "data-is-root-loaded": isRootLoaded
//           });
//           var $name= $("<span>", {
//               class: "folder-name toggle",
//               text: node.name
//           });

//           $div.append($toggle);
//           $div.append($img);
//           $div.append($name);

//           if (isRoot)
//           {
//               var $actionLink= $("<button>", {  
//                 text:"Remove" ,href: "", 
//                 "data-node-id" :node.id,
//                 style:"float:right",
                
//               });
//               $actionLink.on("click", async function () 
//               {
//                 const nodeId = $(this).data("node-id"); 
//                 try 
//                 { 
//                   removeCaseFromFavorites(nodeId);
//                   $(this).parent().remove();                  
//                   toastr.success("Successful removed from Favorites list"); 
//                 } catch (error) 
//                 {                  
//                   toastr.error("Removed from Favorites list failed!"); 
//                 }
//               });
        
//               $div.append($actionLink);
//           }


//           // Placeholder na dzieci
//           var $childContainer = $("<div>", {
//               class: "children",
//               css: { "margin-left": "20px", "display": "none" }
//           });

//           $div.append($childContainer);
//           container.append($div);

//           // Obsługa kliknięcia
//           $toggle.on("click", async function () {
//               const isVisible = $childContainer.is(":visible");
//               $childContainer.toggle();
//               $toggle.text((isVisible ? "+ " : "-  "));

//               // Ładowanie podstruktury tylko przy pierwszym kliknięciu
//               if (!isVisible && !$childContainer.data("loaded")) {
//                   const nodeId = $(this).data("node-id");
//                   const isLastNodeId = $(this).data("last-node");
              
//                   const subNodesee = await getStructure(nodeId); //async load
//                   var structure =  subNodesee.filter((x) => x.isStructure == true);
//                   var files =  subNodesee.filter(x => x.isStructure==false);
//                   buildTree(structure, $childContainer, false);
//                   buildItemsTree(files, $childContainer);//where(x=> x.IsStruture==true)
//                   $childContainer.data("loaded", true); // flag that it's loaded
 
//               }
//           });
//       });
//   }

//   // Początkowe ładowanie root'ów
//   buildTree(initialData, $rootElement, true);
// }



// function buildItemsTree(nodes, container) {
//   nodes.forEach(node => {
//       var $div = $("<div>", { class: "file-tag", id: "file-" + node.id });

//       var $img = $("<img>", {
//         src: "assets/item-16.png",
//         class: "folder-icon"
//        });
//       // Tytuł + toggle
//       var $toggle = $("<span>", {
//           text: node.name,
//           "data-node-id": node.id,
//           "data-last-node": node.lastNode,
//           "data-url": node.url
//       });
//       $div.append($img);
//       $div.append($toggle);
//       if (node.hasUrl)
//       {
//         var $actionLink= $("<button>", {  
//           text:"Open" ,href: "", 
//           style:"float:right"
//         });

//         $div.append($actionLink);
//       }
//       container.append($div);

//       // Obsługa kliknięcia
//       $toggle.on("click", async function () {
        
//         toastr.success("Successful cliecked URL"); 
//           var url=  $(this).data("url");
//           console.log(url); 
//       });
//   });
// }


 


// export async function CaseDownloadStructure()
// {
//   const initialData = await getMyFavorites(); 
//   initCaseStructure(initialData, true);
// }

// export async function CaseSearchStructure()
// {
//   const initialData =  document.getElementById('text-search-input').value;
 
//   searchCases(initialData)
//   .then(data => {
//     const $results = $("#results-container");
//     $results.empty();  

//     data.forEach(item => {
//       const $row = $("<div>", { class: "result-row" });

//       $row.append($("<div>", {class:"name"}).text(item.name));
//       $row.append($("<div>", {class:"causa"}).text(item.causa));

//       const $div = $("<div>", {"data-node-id": item.id, class: "button"})
//       .html(`<button>Add to favorite</button>`)
//       .on("click", async function () 
//          {
//           const nodeId = $(this).data("node-id");
//           console.log(nodeId);
//          var dataToLoad = await addCaseToFavorites(nodeId);
//          initCaseStructure(dataToLoad, true);
//          }
//       );

//       $row.append($div);

//       $results.append($row);
//     });
//   })
//   .catch(err => {
//     console.error("Błąd podczas wyszukiwania:", err);
//     toastr.error("Search case failed: " + err); 
//   });
// }



















// ///////
// // Actions
// /////
// function addCaseToFavorites(nodeIsd) {
//   return fetch("https://localhost:7231/WeatherForecast/AddToFavorites", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({ nodeId: nodeIsd })
//   })
//     .then(res => res.json())
//     .catch(error => {
//       console.error("Błąd fetch:", error);
//       toastr.error("Add to favorites list failed: " + err); 
//     });
// }

// async function removeCaseFromFavorites(nodeId) {
//      try {
//       const res = await  fetch("https://localhost:7231/WeatherForecast/RemoveFromFavorites", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify({ nodeId: nodeId })
//       });
  
//       if (!res.ok) {
        
//         toastr.error("Removed from favorites list failed: " + res.status); 
//         throw new Error(`Błąd HTTP ${res.status}: ${res.statusText}`);
//       }
  
//     //  const data = await res.json();
//       return res;
  
//     } catch (err) {
//       console.error("Błąd podczas wyszukiwania:", err);
      
//       toastr.error("Removed from favorites list failed: " + err); 
//       throw err;  
//     }


// }

// function searchCases(searchQuery) {
//   return fetch("https://localhost:7231/WeatherForecast/SearchCases", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({ query: searchQuery })
//   })
//     .then(res => res.json())
//     .catch(error => {
//       console.error("Błąd fetch:", error);
//       toastr.error("Search failed: " + error);  
//     });
// }

// function getStructure(nodeId) {
//   return fetch("https://localhost:7231/WeatherForecast/GetStructureById?parentId=" + nodeId)
//       .then(res => res.json())   
//       .catch(error => {
//         console.error("Błąd fetch:", error); 
//         toastr.error("Get struture failed: " + error);  
//       });
// }

 

// function getMyFavorites(nodeId) {
//   return fetch("https://localhost:7231/WeatherForecast/GetMyFavorites")
//       .then(res => res.json())
//       .catch(error => {
//         console.error("Błąd fetch:", error); 
//         toastr.error("Get my Favorites failed: " + error);  
//       });
 
// }
 