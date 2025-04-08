/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

Office.onReady(async (info) => { 
 
  if (info.host === Office.HostType.Outlook) {
    document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure;
    document.getElementById("search-case-id").onclick = CaseSearchStructure;
  }
});


 
function initCaseStructure(initialData) 
{
  var $rootElement = $("#caseStructure");

  function buildTree(nodes, container) 
  {
      nodes.forEach(node => {
          var $div = $("<div>", { class: "folder-row", id: "folder-" + node.id });

          var $img = $("<img>", {
            src: "assets/icon-16.png",
            class: "folder-icon"
           });
          // Tytuł + toggle
          var $toggle = $("<span>", {
              class: "toggle",
              text: "+ ",
              "data-node-id": node.id,
              "data-last-node": node.lastNode
          });
          var $name= $("<span>", {
              class: "folder-name toggle",
              text: node.name
          });
          $div.append($toggle);
          $div.append($img);
          $div.append( $name);

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
                  if (isLastNodeId)
                    {
                      // try {
                      //   const subNodes = await createItemStructure(nodeId); // async load
                      //   buildItemsTree(subNodes, $childContainer);
                      //   $childContainer.data("loaded", true); // flag that it's loaded
                      // } catch (error) {
                      //     console.error("Błąd ładowania itemów:", error);
                      // }
                      
                      loadItems(nodeId, $childContainer);
                    }
                    else 
                    {
                      try {
                          const subNodes = await createCaseStructure(nodeId); // async load
                          buildTree(subNodes, $childContainer);
                          $childContainer.data("loaded", true); // flag that it's loaded
                      } catch (error) {
                          console.error("Błąd ładowania podstruktury:", error);
                      }
                  }
              }
          });
      });
  }



  // Początkowe ładowanie root'ów
  buildTree(initialData, $rootElement);
}


function buildItemsTree(nodes, container) {
  nodes.forEach(node => {
      var $div = $("<div>", { class: "file-tag", id: "file-" + node.id });

      // Tytuł + toggle
      var $toggle = $("<span>", {
          class: "toggle",
          text: node.name,
          "data-node-id": node.id,
          "data-last-node": node.lastNode,
          "data-url": "url"
      });

      $div.append($toggle);

      // Placeholder na dzieci
      // var $childContainer = $("<div>", {
      //     class: "children",
      //     css: { "margin-left": "20px" }
      // });

      // $div.append($childContainer);
      container.append($div);

      // Obsługa kliknięcia
      $toggle.on("click", async function () {
          var url=  $(this).data("url");
          console.log(url); 
      });
  });
}



async function loadItems(nodeId,  childContainer)
{
  try {
    const subNodes = await createItemStructure(nodeId); // async load
    buildItemsTree(subNodes, childContainer);
    childContainer.data("loaded", true); // flag that it's loaded
  } catch (error) {
      console.error("Błąd ładowania itemów:", error);
  }
}
export async function CaseDownloadStructure()
{
  const initialData = await createCaseStructure(0); // ładowanie root'ów
  initCaseStructure(initialData);
}

export async function CaseSearchStructure()
{
  const initialData =  document.getElementById('text-search-input').value;
  // searchCases(initialData);
  searchCases(initialData)
  .then(data => {
    const $results = $("#results-container");
    $results.empty(); // czyść stare dane

    data.forEach(item => {
      const $row = $("<div>", { class: "result-row" });

      $row.append($("<div>").text(item.caseId));
      $row.append($("<div>").text(item.causa));
      $row.append($("<div>").html(`<button class="fav-btn">Add to favorite</button>`));

      $results.append($row);
    });
  })
  .catch(err => {
    console.error("Błąd podczas wyszukiwania:", err);
  });
}
function createItemStructure(nodeId) {
  return fetch("https://localhost:7231/WeatherForecast/GetItemsByParentId?parentId=" + nodeId)
      .then(res => res.json());
}

// function searchCases(searchQuery) {
//       return fetch("https://localhost:7231/WeatherForecast/SearchCases", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
 
//       body: JSON.stringify({ query: searchQuery })
//     })
//     .then(res => res.json());

 
// }


function searchCases(searchQuery) {
  return fetch("https://localhost:7231/WeatherForecast/SearchCases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: searchQuery })
  })
    .then(res => res.json());
}

// $("#search-case-id").on("click", function () {
//   const query = $("#text-search-input").val();
//   if (!query) return;

//   searchCases(query)
//     .then(data => {
//       const $results = $("#results-container");
//       $results.empty(); // czyść stare dane

//       data.forEach(item => {
//         const $row = $("<div>", { class: "result-row" });

//         $row.append($("<div>").text(item.caseId));
//         $row.append($("<div>").text(item.causa));
//         $row.append($("<div>").html(`<button class="fav-btn">Add to favorite</button>`));

//         $results.append($row);
//       });
//     })
//     .catch(err => {
//       console.error("Błąd podczas wyszukiwania:", err);
//     });
// });


function createCaseStructure(nodeId) {
  return fetch("https://localhost:7231/WeatherForecast/GetStructureById?parentId=" + nodeId)
      .then(res => res.json());
}

export async function GetItems(id) {
  // Define the API URL
    //  const apiUrl = 'https://localhost:7231/WeatherForecast';
      debugger;
      var itemsData ;
 
      $.ajax({
        type: 'GET',
        url: 'https://localhost:7231/WeatherForecast/GetMyItems?',
        contentType: "application/json",
        //headers: { 'Authorization': 'Bearer ' + accessToken },
        async: false,
        success: function (data) {
          console.log(data);
          itemsData = data;
          // CreateCaseStructure(data);
        },
        error: function (textStatus, errorThrown) {
          console.log(errorThrown);
        }
  
      });
  
       
  }

 