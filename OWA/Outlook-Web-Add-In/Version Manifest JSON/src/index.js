/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */
 

Office.onReady(async (info) => { 
 
  if (info.host === Office.HostType.Outlook) {
 
  }
 
});
document.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileList = document.getElementById('file-list');
  const objectContent = document.getElementById('object-content');

  dropArea.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropArea.style.borderColor = '#000';
  });

  dropArea.addEventListener('dragleave', () => {
      dropArea.style.borderColor = '#ccc';
  });

  dropArea.addEventListener('drop', (event) => {
      event.preventDefault();
      dropArea.style.borderColor = '#ccc';

      dropArea.innerHTML = '';
      objectContent.innerHTML = '';
      listDragFormats(event.dataTransfer);

      const text = event.dataTransfer.getData('text');
      showText(text);

      const files = event.dataTransfer.files;
      displayFiles(files);

      if (text) {
          const jsonObject = JSON.parse(text);
          displayObjectContent(jsonObject);
      }
  });

  function listDragFormats(dataTransfer) {
      const formats = dataTransfer.types;
      console.log('Verfügbare Drag-and-Drop-Formate:', formats); // Konsolenausgabe zur Überprüfung
      const formatList = document.createElement('div');
      formatList.innerHTML = '<strong>Verfügbare Drag-and-Drop-Formate:</strong>';
      formats.forEach(format => {
          formatList.appendChild(createItemElement(format));
          const text = event.dataTransfer.getData(format);
          objectContent.appendChild(createItemElement(format, 'h1'));
          objectContent.appendChild(createItemElement(text, 'pre'));
          displayObjectContent(JSON.parse(text));
      });

      dropArea.appendChild(formatList);
  }

  function showText(text) {
      const header = document.createElement('div');
      header.innerHTML = '<strong>Text:</strong>';
      dropArea.appendChild(header);
      dropArea.appendChild(createItemElement(text));
  }

  function displayFiles(files) {
      fileList.innerHTML = '';
      for (const file of files) {
          fileList.appendChild(createItemElement(`Dateiname: ${file.name}, Größe: ${file.size} bytes`));
      }
  }

  function createItemElement(text, elementName = 'div') {
      const listItem = document.createElement(elementName);
      listItem.textContent = text;
      return listItem;
  }

  function displayObjectContent(object, parentElement = objectContent) {
      for (const key in object) {
          if (object.hasOwnProperty(key)) {
              const value = object[key];
              const listItem = document.createElement('div');
              listItem.textContent = `${key}: `;
              displayObjectContentValue(value, listItem);
              parentElement.appendChild(listItem);
          }
      }
  }

  function displayObjectContentValue(value, listItem) {
      if (Array.isArray(value)) {
          const arrayContainer = document.createElement('div');
          arrayContainer.style.marginLeft = '20px';
          listItem.appendChild(arrayContainer);
          value.forEach((item, index) => {
              const arrayItem = document.createElement('div');
              arrayItem.textContent = `[${index}]: `;
              displayObjectContentValue(item, arrayItem);
              arrayContainer.appendChild(arrayItem);
          });
      } else if (typeof value === 'object' && value !== null) {
          const objectContainer = document.createElement('div');
          objectContainer.style.marginLeft = '20px';
          listItem.appendChild(objectContainer);
          displayObjectContent(value, objectContainer);
      } else {
          listItem.textContent += value;
      }

  }
});