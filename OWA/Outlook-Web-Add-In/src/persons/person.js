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
        const $results = $("#person-results-container");
        $results.empty();  

        data.forEach(item => {
        const $row = $("<div>", { class: "result-row" });

        $row.append($("<div>", {class:"name"}).text(item.fullName));
        $row.append($("<div>", {class:"causa"}).text(item.city));

        const $div = $("<div>", {"data-node-id": item.id, "data-node-text":item.fullName, class: "button"})
        .html(`<button>Add</button>`)
        .on("click", async function () 
            {
            const nodeId = $(this).data("node-id");
            // const nodeId = $(this).data("node-id");
            console.log(nodeId);
            //$("#service-case-id-input").val(nodeId);
            
           var dataToLoad = await addPerson(nodeId);
                LoadPersons();
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

function GeneratePersonTilesOld(initialData) 
{
  var $rootElement = $("#person-card-container");
 
  function buildTree(nodes, container) 
  {
    container.empty();
      nodes.forEach(node => 
        { 
            var $details = $("<details>", { class: "person-panel", id: "folder-" + node.id });
            var $summary = $("<summary>");
            var $summary_left = $("<div>", { class: "summary-left" });
      
            var $toggle_icon = $("<span>", { class: "toggle-icon" });
            var $person_icon = $("<span>", { class: "material-icons person-icon", text: "person" });
            var $person_name = $("<span>", { class: "person-name", text: node.fullName });
            var $del_button = $("<buton>", { class: "delete" , text :"Delete", "data-person-id": node.id});
            $del_button.on("click", async function () 
            {
              const nodeId = $(this).data("person-id"); 
              try 
              { 
                 removePerson(nodeId);
                // $(this).parent().remove();     
                var toRemove = $("#folder-"+nodeId);
                toRemove.remove();
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
            $details.append($summary);

            //     <div class="details-content">
            var $details_content = $("<div>", { class: "details-content"});

            //       <div class="row">
            //         <span class="material-icons">home</span><span class="label">Address:</span>
            //         </div>
            //       <div class="row"> 
            //         <div><span class="value"></span></div>
            //       </div>

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
            $details_content.append($details_row_address_data);

            
            
//       <div class="row">
//         <span class="material-icons">call</span> 
//          <span class="label">Telefon:</span> 
//       </div>
//       <div class="row"> 
//         <div><span class="value">XXX XXXXXXXXXX</span></div>
//       </div>
            var $details_row_phone = $("<div>", { class: "row"});
            var $details_row_phone_span1 = $("<span>", { class: "material-icons", text:"call"});
            var $details_row_phone_span2 = $("<span>", { class: "label", text:"Phone:"});
            $details_content.append($details_row_phone);
            $details_row_phone.append($details_row_phone_span1, $details_row_phone_span2); 
             
            var $details_row_phone_data = $("<div>", { class: "row"});
            var $details_row_phone_data_div = $("<div>");
            var $details_row_phone_data_span = $("<span>", { class: "value", text: node.phone}); 

            $details_row_phone_data_div.append($details_row_phone_data_span);
            $details_row_phone_data.append($details_row_phone_data_div);             
            $details_content.append( $details_row_phone_data);
           


//       <div class="row">
//         <span class="material-icons">email</span><span class="label">Email:</span> 
//       </div>
//       <div class="row"> 
//         <div><span class="value">XXX XXXXXXXXXX</span></div>
//       </div>

            var $details_row_email = $("<div>", { class: "row"});
            var $details_row_email_span1 = $("<span>", { class: "material-icons", text:"email"});
            var $details_row_email_span2 = $("<span>", { class: "label", text:"Email:"});
            $details_content.append($details_row_email);
            $details_row_email.append($details_row_email_span1, $details_row_email_span2); 
             
            var $details_row_email_data = $("<div>", { class: "row"});
            var $details_row_email_data_div = $("<div>");
            var $details_row_email_data_span = $("<span>", { class: "value", text: node.email}); 

            $details_row_email_data_div.append($details_row_email_data_span);
            $details_row_email_data.append($details_row_email_data_div);             
            $details_content.append( $details_row_email_data);
           

//       <div class="row">
//         <span class="material-icons">language</span><span class="label">Website:</span>
//       </div>     
//       <div class="row"> 
//         <div><span class="value"><a href="https://websitenameneingeben.com" target="_blank">websitenameneingeben.com</a></span></div>
//       </div>
            var $details_row_website = $("<div>", { class: "row"});
            var $details_row_website_span1 = $("<span>", { class: "material-icons", text:"language"});
            var $details_row_website_span2 = $("<span>", { class: "label", text:"Website:"});
            $details_content.append($details_row_website);
            $details_row_website.append($details_row_website_span1, $details_row_website_span2); 
             
            var $details_row_website_data = $("<div>", { class: "row"});
            var $details_row_website_data_div = $("<div>");
            var $details_row_website_data_span = $("<span>", { class: "value", text: node.webSite}); 

            $details_row_website_data_div.append($details_row_website_data_span);
            $details_row_website_data.append($details_row_website_data_div);             
            $details_content.append( $details_row_website_data);
 
            $details.append($details_content);
            container.append($details);
      });
  }

  // Początkowe ładowanie root'ów
  buildTree(initialData, $rootElement);
}

 
function GeneratePersonTiles(initialData) 
{
  var $rootElement = $("#person-card-container");
 
  function buildTree(nodes, container) 
  {
    container.empty();
      nodes.forEach(node => 
        { 
            var $details = $("<details>", { class: "person-panel", id: "folder-" + node.id });
            var $summary = $("<summary>");
            var $summary_left = $("<div>", { class: "summary-left" });
      
            var $toggle_icon = $("<span>", { class: "toggle-icon" });
            var $person_icon = $("<span>", { class: "material-icons person-icon", text: "person" });
            var $person_name = $("<span>", { class: "person-name", text: node.fullName });
            var $del_button = $("<buton>", { class: "delete" , text :"Delete", "data-person-id": node.id});
            $del_button.on("click", async function () 
            {
              const nodeId = $(this).data("person-id"); 
              try 
              { 
                 removePerson(nodeId);
                // $(this).parent().remove();     
                var toRemove = $("#folder-"+nodeId);
                toRemove.remove();
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
            $details.append($summary);

            //     <div class="details-content">
            var $details_content = $("<div>", { class: "details-content"});

            //       <div class="row">
            //         <span class="material-icons">home</span><span class="label">Address:</span>
            //         </div>
            //       <div class="row"> 
            //         <div><span class="value"></span></div>
            //       </div>

            var $details_row = $("<div>", { class: "row"});
            var $details_row_span1 = $("<span>", { class: "material-icons", text:"home"});
            var $details_row_span2 = $("<span>", { class: "label", text:"Address:"});
            $details_content.append($details_row);
            $details_row.append($details_row_span1, $details_row_span2); 
              
            var $details_row_address_data_div = $("<div>");
            var $details_row_address_data_span = $("<span>", { class: "value", text: node.address}); 

            $details_row_address_data_div.append($details_row_address_data_span);
            $details_row.append($details_row_address_data_div);     

            
            
//       <div class="row">
//         <span class="material-icons">call</span> 
//          <span class="label">Telefon:</span> 
//       </div>
//       <div class="row"> 
//         <div><span class="value">XXX XXXXXXXXXX</span></div>
//       </div>
            var $details_row_phone = $("<div>", { class: "row"});
            var $details_row_phone_span1 = $("<span>", { class: "material-icons", text:"call"});
            var $details_row_phone_span2 = $("<span>", { class: "label", text:"Phone:"});
            $details_content.append($details_row_phone);
            $details_row_phone.append($details_row_phone_span1, $details_row_phone_span2); 
              
            var $details_row_phone_data_div = $("<div>");
            var $details_row_phone_data_span = $("<span>", { class: "value", text: node.phone}); 

            $details_row_phone_data_div.append($details_row_phone_data_span);
            $details_row_phone.append($details_row_phone_data_div);             
         
           


//       <div class="row">
//         <span class="material-icons">email</span><span class="label">Email:</span> 
//       </div>
//       <div class="row"> 
//         <div><span class="value">XXX XXXXXXXXXX</span></div>
//       </div>

            var $details_row_email = $("<div>", { class: "row"});
            var $details_row_email_span1 = $("<span>", { class: "material-icons", text:"email"});
            var $details_row_email_span2 = $("<span>", { class: "label", text:"Email:"});
            $details_content.append($details_row_email);
            $details_row_email.append($details_row_email_span1, $details_row_email_span2); 
              
            var $details_row_email_data_div = $("<div>");
            var $details_row_email_data_span = $("<span>", { class: "value", text: node.email}); 

            $details_row_email_data_div.append($details_row_email_data_span);
            $details_row_email.append($details_row_email_data_div);             
   
           

//       <div class="row">
//         <span class="material-icons">language</span><span class="label">Website:</span>
//       </div>     
//       <div class="row"> 
//         <div><span class="value"><a href="https://websitenameneingeben.com" target="_blank">websitenameneingeben.com</a></span></div>
//       </div>
            var $details_row_website = $("<div>", { class: "row"});
            var $details_row_website_span1 = $("<span>", { class: "material-icons", text:"language"});
            var $details_row_website_span2 = $("<span>", { class: "label", text:"Website:"});
            $details_content.append($details_row_website);
            $details_row_website.append($details_row_website_span1, $details_row_website_span2); 
              
            var $details_row_website_data_div = $("<div>");
            var $details_row_website_data_span = $("<span>", { class: "value", text: node.webSite}); 

            $details_row_website_data_div.append($details_row_website_data_span);
            $details_row_website.append($details_row_website_data_div);   
 
            $details.append($details_content);
            container.append($details);
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
  
