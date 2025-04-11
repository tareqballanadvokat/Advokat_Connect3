/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

import { formatDate } from "../helpers/helper";
import toastr from "toastr";



Office.onReady(async (info) => { 
 
  if (info.host === Office.HostType.Outlook) {
    document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure; 
    document.getElementById("search-case-id").onclick = CaseSearchStructure;
    ///test
    console.log(formatDate(new Date()));
    toastr.success("Add In loaded correctly"); 
  }
 
});


 
function initCaseStructure(initialData, isRootLoaded) 
{
  var $rootElement = $("#caseStructure");

  function buildTree(nodes, container, isRoot) 
  {
      nodes.forEach(node => 
        {
          var $div = $("<div>", { class: "folder-row", id: "folder-" + node.id });

          var $img = $("<img>", {
            src: "assets/folder-16.png",
            class: "folder-icon"
           });
          // Tytuł + toggle
          var $toggle = $("<span>", {
              class: "toggle",
              text: "+ ",
              "data-node-id": node.id,
              "data-last-node": node.lastNode,
              "data-is-root-loaded": isRootLoaded
          });
          var $name= $("<span>", {
              class: "folder-name toggle",
              text: node.name
          });

          $div.append($toggle);
          $div.append($img);
          $div.append($name);

          if (isRoot)
          {
              var $actionLink= $("<button>", {  
                text:"Remove" ,href: "", 
                "data-node-id" :node.id,
                style:"float:right",
                
              });
              $actionLink.on("click", async function () 
              {
                const nodeId = $(this).data("node-id"); 
                try 
                { 
                  removeCaseFromFavorites(nodeId);
                  $(this).parent().remove();                  
                  toastr.success("Successful removed from Favorites list"); 
                } catch (error) 
                {                  
                  toastr.error("Removed from Favorites list failed!"); 
                }
              });
        
              $div.append($actionLink);
          }


          // Placeholder na dzieci
          var $childContainer = $("<div>", {
              class: "children",
              css: { "margin-left": "20px", "display": "none" }
          });

          $div.append($childContainer);
          container.append($div);

          // Obsługa kliknięcia
          $toggle.on("click", async function () {
              const isVisible = $childContainer.is(":visible");
              $childContainer.toggle();
              $toggle.text((isVisible ? "+ " : "-  "));

              // Ładowanie podstruktury tylko przy pierwszym kliknięciu
              if (!isVisible && !$childContainer.data("loaded")) {
                  const nodeId = $(this).data("node-id");
                  const isLastNodeId = $(this).data("last-node");
              
                  const subNodesee = await getStructure(nodeId); //async load
                  var structure =  subNodesee.filter((x) => x.isStructure == true);
                  var files =  subNodesee.filter(x => x.isStructure==false);
                  buildTree(structure, $childContainer, false);
                  buildItemsTree(files, $childContainer);//where(x=> x.IsStruture==true)
                  $childContainer.data("loaded", true); // flag that it's loaded
 
              }
          });
      });
  }

  // Początkowe ładowanie root'ów
  buildTree(initialData, $rootElement, true);
}



function buildItemsTree(nodes, container) {
  nodes.forEach(node => {
      var $div = $("<div>", { class: "file-tag", id: "file-" + node.id });

      var $img = $("<img>", {
        src: "assets/item-16.png",
        class: "folder-icon"
       });
      // Tytuł + toggle
      var $toggle = $("<span>", {
          text: node.name,
          "data-node-id": node.id,
          "data-last-node": node.lastNode,
          "data-url": node.url
      });
      $div.append($img);
      $div.append($toggle);
      if (node.hasUrl)
      {
        var $actionLink= $("<button>", {  
          text:"Open" ,href: "", 
          style:"float:right"
        });

        $div.append($actionLink);
      }
      container.append($div);

      // Obsługa kliknięcia
      $toggle.on("click", async function () {
        
        toastr.success("Successful cliecked URL"); 
          var url=  $(this).data("url");
          console.log(url); 
      });
  });
}


 


export async function CaseDownloadStructure()
{
  const initialData = await getMyFavorites(); 
  initCaseStructure(initialData, true);
}

export async function CaseSearchStructure()
{
  const initialData =  document.getElementById('text-search-input').value;
 
  searchCases(initialData)
  .then(data => {
    const $results = $("#results-container");
    $results.empty();  

    data.forEach(item => {
      const $row = $("<div>", { class: "result-row" });

      $row.append($("<div>", {class:"name"}).text(item.name));
      $row.append($("<div>", {class:"causa"}).text(item.causa));

      const $div = $("<div>", {"data-node-id": item.id, class: "button"})
      .html(`<button>Add to favorite</button>`)
      .on("click", async function () 
         {
          const nodeId = $(this).data("node-id");
          console.log(nodeId);
         var dataToLoad = await addCaseToFavorites(nodeId);
         initCaseStructure(dataToLoad, true);
         }
      );

      $row.append($div);

      $results.append($row);
    });
  })
  .catch(err => {
    console.error("Błąd podczas wyszukiwania:", err);
    toastr.error("Search case failed: " + err); 
  });
}



















///////
// Actions
/////
function addCaseToFavorites(nodeIsd) {
  return fetch("https://localhost:7231/WeatherForecast/AddToFavorites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ nodeId: nodeIsd })
  })
    .then(res => res.json())
    .catch(error => {
      console.error("Błąd fetch:", error);
      toastr.error("Add to favorites list failed: " + err); 
    });
}

async function removeCaseFromFavorites(nodeId) {
     try {
      const res = await  fetch("https://localhost:7231/WeatherForecast/RemoveFromFavorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nodeId: nodeId })
      });
  
      if (!res.ok) {
        
        toastr.error("Removed from favorites list failed: " + res.status); 
        throw new Error(`Błąd HTTP ${res.status}: ${res.statusText}`);
      }
  
    //  const data = await res.json();
      return res;
  
    } catch (err) {
      console.error("Błąd podczas wyszukiwania:", err);
      
      toastr.error("Removed from favorites list failed: " + err); 
      throw err;  
    }


}

function searchCases(searchQuery) {
  return fetch("https://localhost:7231/WeatherForecast/SearchCases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: searchQuery })
  })
    .then(res => res.json())
    .catch(error => {
      console.error("Błąd fetch:", error);
      toastr.error("Search failed: " + error);  
    });
}

function getStructure(nodeId) {
  return fetch("https://localhost:7231/WeatherForecast/GetStructureById?parentId=" + nodeId)
      .then(res => res.json())   
      .catch(error => {
        console.error("Błąd fetch:", error); 
        toastr.error("Get struture failed: " + error);  
      });
}

 

function getMyFavorites(nodeId) {
  return fetch("https://localhost:7231/WeatherForecast/GetMyFavorites")
      .then(res => res.json())
      .catch(error => {
        console.error("Błąd fetch:", error); 
        toastr.error("Get my Favorites failed: " + error);  
      });
 
}
 