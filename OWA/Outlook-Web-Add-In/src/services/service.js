/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

import { formatDate } from "../helpers/helper.js";
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { addCaseToFavorites, removeCaseFromFavorites, getMyFavorites, getStructure, searchCases } from "../helpers/webApiReqests";
import { initCase } from "../cases/case.js";
 
Office.onReady(async (info) => { 

  if (info.host === Office.HostType.Outlook) 
  {
      initCase();
  }
});


 