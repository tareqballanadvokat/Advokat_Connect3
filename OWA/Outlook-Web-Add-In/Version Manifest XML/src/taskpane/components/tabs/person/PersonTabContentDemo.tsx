import React, { useCallback, useState, useEffect } from 'react';
import Accordion, { type AccordionTypes } from 'devextreme-react/accordion';
import CheckBox, { type CheckBoxTypes } from 'devextreme-react/check-box';
import TagBox, { type TagBoxTypes } from 'devextreme-react/tag-box';
import Slider, { Tooltip, Label, type SliderTypes } from 'devextreme-react/slider';
import { getSavedEmailInfo, getPersonApi, Person } from '../../../utils/api';
 import SearchPersonList from './SearchPersonList'
import service from './data';
import CustomTitle from './CustomTitle';
import CustomItem from './CustomItem';
import './person.css';  


 

const companyLabel = { 'aria-label': 'Company' };
var companies =[];// service.getCompanies();

const PersonTabContentDemo = () => {
  const [selectedItems, setSelectedItems] = useState<Person[]>([]);
  const [multiple, setMultiple] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  const [animationDuration, setAnimationDuration] = useState(300);

  // const selectionChanged = useCallback((e: AccordionTypes.SelectionChangedEvent) => {
  //   let newItems = [...selectedItems];
  //   e.removedItems.forEach((item) => {
  //     const index = newItems.indexOf(item);
  //     if (index >= 0) {
  //       newItems.splice(index, 1);
  //     }
  //   });
  //   if (e.addedItems.length) {
  //     newItems = [...newItems, ...e.addedItems];
  //   }
  //   setSelectedItems(newItems);
  // }, [selectedItems, setSelectedItems]);

  // const selectedItemsChanged = useCallback((e: TagBoxTypes.ValueChangedEvent) => {
  //   setSelectedItems(e.value);
  // }, [setSelectedItems]);

  // const multipleChanged = useCallback((e: CheckBoxTypes.ValueChangedEvent) => {
  //   setMultiple(e.value);
  // }, [setMultiple]);

  // const collapsibleChanged = useCallback((e: CheckBoxTypes.ValueChangedEvent) => {
  //   setCollapsible(e.value);
  // }, [setCollapsible]);

  // const animationDurationChanged = useCallback((e: SliderTypes.ValueChangedEvent) => {
  //   setAnimationDuration(e.value);
  // }, [setAnimationDuration]);




  // useEffect(() => {
  //   (async () => { 
 

  //       // Step 1: Dictionaries  
  //      // debugger;      
  //    var selectedItems2 = await getPersonApi();
  //    setSelectedItems(selectedItems2);
  //     console.log(selectedItems);
  //   })();
  // }, []);

useEffect(() => {
  (async () => {
    const selectedItems2 = await getPersonApi();
    console.log('Fetched persons:', selectedItems2);
    setSelectedItems(selectedItems2);
  })();
}, []);




  return ( 
    <div id="accordion">
      <Accordion
        dataSource={selectedItems}
        collapsible={true}
        multiple={true}
        animationDuration={500}
        selectedItems={selectedItems}
        // onSelectionChanged={selectionChanged}
        itemTitleRender={CustomTitle}
        itemRender={CustomItem}
        id="accordion-container"
      />
      {/* <div className="options">
        <div className="caption">Options</div>
        <div className="option">
          <CheckBox
            text="Multiple enabled"
            value={multiple}
            onValueChanged={multipleChanged}
          />
        </div>
        <div className="option">
          <CheckBox
            text="Collapsible enabled"
            value={collapsible}
            onValueChanged={collapsibleChanged}
          />
        </div>
        <div className="option">
          <span>Animation duration</span>
          <Slider
            min={0}
            max={1000}
            value={animationDuration}
            onValueChanged={animationDurationChanged}
          >
            <Tooltip enabled={true} position="bottom" />
            <Label visible={true} />
          </Slider>
        </div>
        <div className="option">
          <span className="caption">Selected Items</span>
          <TagBox
            dataSource={companies}
            displayExpr="CompanyName"
            value={selectedItems}
            inputAttr={companyLabel}
            onValueChanged={selectedItemsChanged}
            disabled={!multiple}
          />
        </div>
      </div> */}
    </div>
  );
};

export default PersonTabContentDemo;
