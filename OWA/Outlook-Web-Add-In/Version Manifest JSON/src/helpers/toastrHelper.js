import toastr from "toastr";

export function setOptions(){
  toastr.options = {
    positionClass: 'toast-bottom-center'
  };
}
export function showSuccess(message){
    toastr.success(message); 
}

export function showError(message, title){
    console.error(  message);
      toastr.error(message, title); 
}