/*
* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
* See LICENSE in the project root for license information.
*/

Office.onReady(async (info) => {
    var jsonBlob = `{
    "actions": [
      {
        "id": "executeWriteData",
        "type": "ExecuteFunction",
        "functionName": "writeData"
      }
    ],
    "tabs": [
      {
        "id": "CtxTab1",
        "label": "Contoso Data",
        "groups": [
          {
            "id": "CustomGroup111",
            "label": "Insertion",
            "icon": [
              {
                  "size": 16,
                  "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/Group16x16.png"
              },
              {
                  "size": 32,
                  "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/Group32x32.png"
              },
              {
                  "size": 80,
                  "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/Group80x80.png"
              }
            ],
            "controls": [
              {
                  "type": "Button",
                  "id": "CtxBt112",
                  "actionId": "executeWriteData",
                  "enabled": false,
                  "label": "Write Data",
                  "superTip": {
                      "title": "Data Insertion",
                      "description": "Use this button to insert data into the document."
                  },
                  "icon": [
                      {
                          "size": 16,
                          "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/WriteDataButton16x16.png"
                      },
                      {
                          "size": 32,
                          "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/WriteDataButton32x32.png"
                      },
                      {
                          "size": 80,
                          "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/WriteDataButton80x80.png"
                      }
                  ]
              }
            ]
          }
        ]
      }
    ]
  }`
  
   debugger;
    const contextualTabJSON = jsonBlob; // Assign the JSON string such as the one at the end of the preceding section.
    const contextualTab = JSON.parse(contextualTabJSON);
    await Office.ribbon.requestCreateControls(contextualTab);
function onMessageSendHandler(event) {
    Office.context.mailbox.item.body.getAsync(
      "text",
      { asyncContext: event },
      getBodyCallback
    );
  }
  
});


  function getBodyCallback(asyncResult){
    const event = asyncResult.asyncContext;
    let body = "";
    if (asyncResult.status !== Office.AsyncResultStatus.Failed && asyncResult.value !== undefined) {
      body = asyncResult.value;
    } else {
      const message = "Failed to get body text";
      console.error(message);
      event.completed({ allowEvent: false, errorMessage: message });
      return;
    }
  
    const matches = hasMatches(body);
    if (matches) {
      Office.context.mailbox.item.getAttachmentsAsync(
        { asyncContext: event },
        getAttachmentsCallback);
    } else {
      event.completed({ allowEvent: true });
    }
  }
  
  function hasMatches(body) {
    if (body == null || body == "") {
      return false;
    }
  
    const arrayOfTerms = ["send", "picture", "document", "attachment"];
    for (let index = 0; index < arrayOfTerms.length; index++) {
      const term = arrayOfTerms[index].trim();
      const regex = RegExp(term, 'i');
      if (regex.test(body)) {
        return true;
      }
    }
  
    return false;
  }
  function getAttachmentsCallback(asyncResult) {
    const event = asyncResult.asyncContext;
    if (asyncResult.value.length > 0) {
      for (let i = 0; i < asyncResult.value.length; i++) {
        if (asyncResult.value[i].isInline == false) {
          event.completed({ allowEvent: true });
          return;
        }
      }
  
      event.completed({
        allowEvent: false,
        errorMessage: "Looks like the body of your message includes an image or an inline file. Would you like to attach a copy of it to the message?",
        // TIP: In addition to the formatted message, it's recommended to also set a
        // plain text message in the errorMessage property for compatibility on
        // older versions of Outlook clients.
        errorMessageMarkdown: "Looks like the body of your message includes an image or an inline file. Would you like to attach a copy of it to the message?\n\n**Tip**: For guidance on how to attach a file, see [Attach files in Outlook](https://www.contoso.com/help/attach-files-in-outlook).",
        cancelLabel: "Attach a copy",
        commandId: "msgComposeOpenPaneButton",
        sendModeOverride: Office.MailboxEnums.SendModeOverride.PromptUser
      });
    } else {
      event.completed({
        allowEvent: false,
        errorMessage: "Looks like you're forgetting to include an attachment.",
        // TIP: In addition to the formatted message, it's recommended to also set a
        // plain text message in the errorMessage property for compatibility on
        // older versions of Outlook clients.
        errorMessageMarkdown: "Looks like you're forgetting to include an attachment.\n\n**Tip**: For guidance on how to attach a file, see [Attach files in Outlook](https://www.contoso.com/help/attach-files-in-outlook).",
        cancelLabel: "Add an attachment",
        commandId: "msgComposeOpenPaneButton"
      });
    }
  } 
  // IMPORTANT: To ensure your add-in is supported in Outlook, remember to map the event handler name specified in the manifest to its JavaScript counterpart.
  Office.actions.associate("onMessageSendHandler", onMessageSendHandler);