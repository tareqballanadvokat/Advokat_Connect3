/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

Office.onReady(async (info) => { 
 
  if (info.host === Office.HostType.Outlook) {
    document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure;
 
  }
});



export async function CaseDownloadStructure() {
// Define the API URL
  //  const apiUrl = 'https://localhost:7231/WeatherForecast';
    debugger;
    var structureData ;
    var itemsData ;
    $.ajax({
      type: 'GET',
      url: 'https://localhost:7231/WeatherForecast/GetStructure',
      contentType: "application/json",
      //headers: { 'Authorization': 'Bearer ' + accessToken },
      async: false,
      success: function (data) {
        console.log(data);
        structureData = data;
      },
      error: function (textStatus, errorThrown) {
        console.log(errorThrown);
      }
    });


    $.ajax({
      type: 'GET',
      url: 'https://localhost:7231/WeatherForecast/GetMyItems',
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

    CreateCaseStructure(structureData,itemsData );
}

 
export async function CreateCaseStructure(data, items) 
{
  var $rootElement = $("#caseStructure");

  // Grupujemy elementy po rootId
  var grouped = {};
  data.forEach(item => {
      const key = item.rootId ?? 'root'; // null → 'root'
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
  });

  function buildTree(rootId, container) {
      if (!grouped[rootId]) return;

      grouped[rootId].forEach(node => {
          var $div = $("<div>", { class: "folder", id: "folder-" + node.id });

          // Title node
          var $toggle = $("<span>", {
              class: "toggle",
              text: "+ " + node.name
          });

          $div.append($toggle);

          // container for childrens
          var $childContainer = $("<div>", { class: "children", css: { "margin-left": "20px", "display": "none" } });
          $div.append($childContainer);

          // OnClick
          $toggle.on("click", function () {
              $childContainer.toggle();
          });

          container.append($div);

          // Rekurencja – budujemy podfoldery
          buildTree(node.id, $childContainer);
      });
  }

  buildTree('root', $rootElement);
}