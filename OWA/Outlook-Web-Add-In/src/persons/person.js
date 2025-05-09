/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */ 
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { searchPersons, addPerson, removePerson, getPersons } from "../helpers/webApiReqests";
 
 ///THIS FILE IS FOR SERVICE FUNCTIONS - REPLACE SERVICE.JS WHEN NEEDED
export function initPerson() 
{
    document.getElementById("person-search-button").onclick = ServiceSearchStructure;
 
    LoadPersons();
    //CalculateEmailInfoAndAttachment();
 
    showSuccess("Service Opened", "Your Message"); 
} 

export async function ServiceSearchStructure()
{
  const initialData =  document.getElementById('person-search-input').value;
 
  searchPersons(initialData)
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
 
export async function LoadPersons()
{
  const initialData = await getPersons(); 
  GeneratePersonTiles(initialData);
}
 
function GeneratePersonTiles(initialData) 
{
  var $rootElement = $("#person-card-container");
 
  function buildTree(nodes, container) 
  {


//     <details class="person-panel" open>
//     <summary>
//       <div class="summary-left">
//         <span class="toggle-icon"></span>
//         <span class="material-icons person-icon">person</span>
//         <span class="person-name">ADVOKAT</span>
//       </div>
//       <button class="delete">Delete</button>
//     </summary>
//     <div class="details-content">
//       <div class="row">
//         <span class="material-icons">home</span><span class="label">Address:</span>
//         </div>
//       <div class="row"> 
//         <div><span class="value">Andreas-Hofer-Straße 39b, 6020 Innsbruck, Österreich</span></div>
//       </div>

//       <div class="row">
//         <span class="material-icons">call</span> 
//          <span class="label">Telefon:</span> 
//       </div>
//       <div class="row"> 
//         <div><span class="value">XXX XXXXXXXXXX</span></div>
//       </div>

//       <div class="row">
//         <span class="material-icons">email</span><span class="label">Email:</span> 
//       </div>
//       <div class="row"> 
//         <div><span class="value">XXX XXXXXXXXXX</span></div>
//       </div>

//       <div class="row">
//         <span class="material-icons">language</span><span class="label">Website:</span>
//       </div>     
//       <div class="row"> 
//         <div><span class="value"><a href="https://websitenameneingeben.com" target="_blank">websitenameneingeben.com</a></span></div>
//       </div>
//     </div>
//   </details>
      nodes.forEach(node => 
        {
            debugger;
            var $div = $("<details>", { class: "person-panel", id: "folder-" + node.id });
            var $summary = $("<summary>");
            var $summary_left = $("<div>", { class: "summary-left" });
      
            var $toggle_icon = $("<span>", { class: "toggle-icon" });
            var $person_icon = $("<span>", { class: "material-icons person-icon" });
            var $person_name = $("<span>", { class: "person-name", text: node.fullName });
            var $del_button = $("<buton>", { class: "delete" , text :"Delete", "data-person-id": node.id});
            $del_button.on("click", async function () 
            {
              const nodeId = $(this).data("person-id"); 
              try 
              { 
                // removeCaseFromFavorites(nodeId);
                // $(this).parent().remove();                  
               showSuccess("Successful removed from Favorites list"); 
              } catch (error) 
              {                  
                showError("Removed from Favorites list failed!", "Removing item"); 
              }
            });
            $summary_left.append($toggle_icon);
            $summary_left.append($person_icon);
            $summary_left.append($person_name);
            $summary.append($summary_left);
            $summary.append($del_button);
            $div.append($summary);
            container.append($div);


            var $details_content = $("<div>", { class: "details-content"});
            var $details_row = $("<div>", { class: "row"});
            var $details_row_span1 = $("<span>", { class: "material-icons", text:"home"});
            var $details_row_span2 = $("<span>", { class: "label", text:"Address:"});
            $details_content.append($details_row);
            $details_row.append($details_row_span1, $details_row_span2); 
             
            var $details_row_address_data = $("<div>", { class: "row"});
            var $details_row_address_data_div = $("<div>");
            var $details_row_address_data_span = $("<span>", { class: "value", text: node.address}); 

            $details_row_address_data_div.append($details_row_address_data_span);
            $details_row_address_data.append($details_row_address_data_div);             
            $details_content.append( $details_row_address_data);

//     <div class="details-content">
//       <div class="row">
//         <span class="material-icons">home</span><span class="label">Address:</span>
//         </div>
//       <div class="row"> 
//         <div><span class="value">Andreas-Hofer-Straße 39b, 6020 Innsbruck, Österreich</span></div>
//       </div>



        //   <summary>
        //   <div class="summary-left">
        //     <span class="toggle-icon"></span>
        //     <span class="material-icons person-icon">person</span>
        //     <span class="person-name">ADVOKAT</span>
        //   </div>
        //   <button class="delete">Delete</button>
        // </summary>



        //   // Tytuł + toggle
        //   var $toggle = $("<span>", {
        //       class: "toggle",
        //       text: "+ ",
        //       "data-node-id": node.id,
        //       "data-last-node": node.lastNode,
        //       "data-is-root-loaded": isRootLoaded
        //   });
        //   var $name= $("<span>", {
        //       class: "folder-name toggle",
        //       text: node.name
        //   });

        //   $div.append($toggle);
        //   $div.append($img);
        //   $div.append($name);

        //   if (isRoot)
        //   {
        //       var $actionLink= $("<button>", {  
        //         text:"Remove" ,href: "", 
        //         "data-node-id" :node.id,
        //         style:"float:right",
                
        //       });
        //       $actionLink.on("click", async function () 
        //       {
        //         const nodeId = $(this).data("node-id"); 
        //         try 
        //         { 
        //           removeCaseFromFavorites(nodeId);
        //           $(this).parent().remove();                  
        //          showSuccess("Successful removed from Favorites list"); 
        //         } catch (error) 
        //         {                  
        //           showError("Removed from Favorites list failed!", "Removing item"); 
        //         }
        //       });
        
        //       $div.append($actionLink);
        //   }


          // Placeholder na dzieci
        //   var $childContainer = $("<div>", {
        //       class: "children",
        //       css: { "margin-left": "20px", "display": "none" }
        //   });

        //   $div.append($childContainer);
        //   container.append($div);

          // Obsługa kliknięcia
        //   $toggle.on("click", async function () {
        //       const isVisible = $childContainer.is(":visible");
        //       $childContainer.toggle();
        //       $toggle.text((isVisible ? "+ " : "-  "));

        //       // Ładowanie podstruktury tylko przy pierwszym kliknięciu
        //       if (!isVisible && !$childContainer.data("loaded")) {
        //           const nodeId = $(this).data("node-id");
        //           const isLastNodeId = $(this).data("last-node");
              
        //           const subNodesee = await getStructure(nodeId); //async load
        //           var structure =  subNodesee.filter((x) => x.isStructure == true);
        //           var files =  subNodesee.filter(x => x.isStructure==false);
        //           buildTree(structure, $childContainer, false);
        //           buildItemsTree(files, $childContainer);//where(x=> x.IsStruture==true)
        //           $childContainer.data("loaded", true); // flag that it's loaded
 
        //       }
        //   });
      });
  }

  // Początkowe ładowanie root'ów
  buildTree(initialData, $rootElement);
}


// function GetEmailsInLast7Days() 
// {
//     getRegisteredEmails()
//     .then(data => {
//         const $results = $("#email-tab-last-7-days-registered");
//         $results.empty();  

//         data.forEach(item => {
//         const $row = $("<div>", { class: "result-row" });

//         $row.append($("<div>", {class:"name"}).text(item.emailName));
//         $row.append($("<div>", {class:"causa"}).text(item.internetMessageId));

//         const $div = $("<div>", {"data-node-id": item.caseId, class: "button"});

//         $row.append($div);
//         $results.append($row);
//         });
//     })
//     .catch(err => {
//         showError(err, "Search case failed"); 
//     });
// }
  
