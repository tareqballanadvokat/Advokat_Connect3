/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { addCaseToFavorites, removeCaseFromFavorites, getMyFavorites, getStructure, searchCases } from "../helpers/webApiReqests";
 
 
export function initCase() 
{
    document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure; 
    document.getElementById("search-case-id").onclick = CaseSearchStructure;
    setOptions();
    showSuccess("Your Message Header", "Your Message"); 
}
 
export function initCaseStructure(initialData, isRootLoaded) 
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
                 showSuccess("Successful removed from Favorites list"); 
                } catch (error) 
                {                  
                  showError("Removed from Favorites list failed!", "Removing item"); 
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
export function buildItemsTree(nodes, container) {
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
        
        showSuccess("Successful cliecked URL"); 
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
 
      $row.append($("<div style='width:350px'>", {class:"name"}).text(item.name));
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
    showError(err, "Search case failed"); 
  });
}